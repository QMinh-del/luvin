import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AccountState, ConsentRequirement } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isAgeEligibleOn } from "./age-eligibility";
import {
  dummyVerifyPassword,
  hashPassword,
  verifyPassword,
} from "./password-hasher";
import { PasswordPolicyError } from "./password-policy";
import { PrismaService } from "../prisma/prisma.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { MailSender } from "../mail/mail-sender";
import { StructuredLogger } from "../observability/structured-logger";
import { RateLimitService } from "./rate-limit.service";
import { hashRefreshToken, TokenService } from "./token.service";
import { TurnstileService } from "./turnstile.service";

export type DeviceInput = {
  publicId: string;
  name?: string;
  osVersion?: string;
  appVersion?: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  dateOfBirth: string;
  username: string;
  displayName: string;
  termsVersion: string;
  privacyVersion: string;
  turnstileToken?: string;
  device: DeviceInput;
};

export type LegalAction = "ACCEPT_TERMS" | "ACCEPT_PRIVACY";

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
  accountState: AccountState;
  requiredLegalActions: LegalAction[];
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(RateLimitService) private readonly rateLimits: RateLimitService,
    @Inject(TurnstileService) private readonly turnstile: TurnstileService,
    @Inject(MailSender) private readonly mail: MailSender,
  ) {}

  async register(
    input: RegisterInput,
    requestId: string,
    ip: string,
  ): Promise<AuthResult> {
    const challenged = (await this.rateLimits.consume("register", ip))
      .challenged;
    await this.turnstile.enforce({
      challenged,
      token: input.turnstileToken,
      action: "register",
      ip,
    });
    const email = normalizeEmail(input.email);
    if (!email.includes("@")) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED");
    }
    if (!/^[a-z0-9_]{3,20}$/.test(input.username)) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED");
    }
    if (input.displayName.length < 1 || input.displayName.length > 50) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED");
    }
    if (!isAgeEligibleOn(input.dateOfBirth)) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "AGE_INELIGIBLE");
    }
    const current = await this.currentLegalVersions();
    if (
      input.termsVersion !== current.terms ||
      input.privacyVersion !== current.privacy
    ) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "LEGAL_VERSION_STALE");
    }

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(input.password);
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, error.message);
      }
      throw error;
    }

    const existingEmail = await this.prisma.client.user.findUnique({
      where: { emailNormalized: email },
    });
    if (existingEmail) {
      throw apiError(HttpStatus.CONFLICT, "EMAIL_UNAVAILABLE");
    }
    const existingUsername = await this.prisma.client.profile.findUnique({
      where: { username: input.username },
    });
    if (existingUsername) {
      throw apiError(HttpStatus.CONFLICT, "USERNAME_UNAVAILABLE");
    }

    const userId = randomUUID();
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          emailNormalized: email,
          passwordHash,
          accountState: AccountState.ACTIVE,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          birthDateCorrectionCount: 0,
          ageEligible: true,
          createdAt: now,
          updatedAt: now,
          profile: {
            create: {
              username: input.username,
              displayName: input.displayName,
              createdAt: now,
              updatedAt: now,
            },
          },
          legalConsents: {
            create: {
              id: randomUUID(),
              termsVersion: input.termsVersion,
              privacyVersion: input.privacyVersion,
              acceptedAt: now,
              createdAt: now,
            },
          },
        },
      });
    });
    this.logger.writeEvent("INFO", "auth.registered", { requestId, userId });
    return this.issueSession(userId, input.device, requestId);
  }

  async login(
    emailRaw: string,
    password: string,
    device: DeviceInput,
    requestId: string,
    ip: string,
    turnstileToken?: string,
  ): Promise<AuthResult> {
    const email = normalizeEmail(emailRaw);
    const challenged = (
      await this.rateLimits.consume("login", `${ip}:${email}`)
    ).challenged;
    await this.turnstile.enforce({
      challenged,
      token: turnstileToken,
      action: "login",
      ip,
    });
    const user = await this.prisma.client.user.findUnique({
      where: { emailNormalized: email },
    });
    if (!user) {
      await dummyVerifyPassword(password);
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    const verified = await verifyPassword(password, user.passwordHash);
    if (!verified.ok) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    if (verified.needsRehash) {
      const nextHash = await hashPassword(password);
      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { passwordHash: nextHash, updatedAt: new Date() },
      });
    }
    await this.noticeMinorLegalUpdates(user.id, requestId);
    this.logger.writeEvent("INFO", "auth.login", {
      requestId,
      userId: user.id,
    });
    return this.issueSession(user.id, device, requestId);
  }

  async refresh(
    refreshToken: string,
    devicePublicId: string,
    requestId: string,
    ip: string,
  ): Promise<AuthResult> {
    await this.rateLimits.consume("refresh", ip);
    const hash = hashRefreshToken(refreshToken);
    const session = await this.prisma.client.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { device: true },
    });
    if (!session) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    if (session.device.devicePublicId !== devicePublicId) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    if (session.revokedAt || session.expiresAt <= new Date()) {
      if (session.revokedAt) {
        await this.prisma.client.session.updateMany({
          where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: "REUSE" },
        });
        throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_REFRESH_REUSE_DETECTED");
      }
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    await this.prisma.client.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokeReason: "ROTATED" },
    });
    this.logger.writeEvent("INFO", "auth.refresh", {
      requestId,
      userId: session.userId,
    });
    return this.issueSession(
      session.userId,
      { publicId: devicePublicId },
      requestId,
      session.tokenFamilyId,
      String(session.id),
    );
  }

  async logoutCurrent(sessionId: string, requestId: string): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });
    this.logger.writeEvent("INFO", "auth.logout", { requestId, sessionId });
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.client.session.findMany({
      where: { userId },
      include: { device: true },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      devicePublicId: session.device.devicePublicId,
      revokedAt: session.revokedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    requestId: string,
  ): Promise<void> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if (!session.revokedAt) {
      await this.prisma.client.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), revokeReason: "OWNER_REVOKE" },
      });
      this.logger.writeEvent("INFO", "auth.session.revoked", {
        requestId,
        sessionId,
      });
    }
  }

  async requestPasswordReset(
    emailRaw: string,
    requestId: string,
    ip: string,
    turnstileToken?: string,
  ): Promise<void> {
    const email = normalizeEmail(emailRaw);
    const challenged = (
      await this.rateLimits.consume("password_reset", `${ip}:${email}`)
    ).challenged;
    await this.turnstile.enforce({
      challenged,
      token: turnstileToken,
      action: "password_reset",
      ip,
    });
    const user = await this.prisma.client.user.findUnique({
      where: { emailNormalized: email },
    });
    if (!user || !this.config.passwordRecoveryEnabled) {
      return;
    }
    const token = this.tokens.issueRefreshToken();
    await this.prisma.client.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: token.hash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
      },
    });
    await this.mail.sendPasswordReset(
      requestId,
      user.emailNormalized,
      token.raw,
    );
    this.logger.writeEvent("INFO", "auth.password_reset.requested", {
      requestId,
    });
  }

  async confirmPasswordReset(
    rawToken: string,
    newPassword: string,
    requestId: string,
  ): Promise<void> {
    const hash = hashRefreshToken(rawToken);
    const record = await this.prisma.client.passwordResetToken.findUnique({
      where: { tokenHash: hash },
    });
    const now = new Date();
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(newPassword);
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, error.message);
      }
      throw error;
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, updatedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: "PASSWORD_RESET" },
      });
    });
    this.logger.writeEvent("INFO", "auth.password_reset.confirmed", {
      requestId,
      userId: record.userId,
    });
  }

  async requestEmailChange(
    userId: string,
    password: string,
    newEmailRaw: string,
    requestId: string,
  ): Promise<void> {
    await this.rateLimits.consume("email_change", userId);
    if (!this.config.passwordRecoveryEnabled) {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE");
    }
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const verified = await verifyPassword(password, user.passwordHash);
    if (!verified.ok) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    const newEmail = normalizeEmail(newEmailRaw);
    if (!newEmail.includes("@") || newEmail === user.emailNormalized) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED");
    }
    const taken = await this.prisma.client.user.findUnique({
      where: { emailNormalized: newEmail },
    });
    if (taken) {
      throw apiError(HttpStatus.CONFLICT, "EMAIL_UNAVAILABLE");
    }
    const token = this.tokens.issueRefreshToken();
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        pendingEmailNormalized: newEmail,
        pendingEmailTokenHash: token.hash,
        pendingEmailExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        updatedAt: new Date(),
      },
    });
    await this.mail.sendEmailChange(requestId, newEmail, token.raw);
    this.logger.writeEvent("INFO", "account.email_change.requested", {
      requestId,
      userId,
    });
  }

  async confirmEmailChange(
    userId: string,
    rawToken: string,
    requestId: string,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const hash = hashRefreshToken(rawToken);
    const now = new Date();
    if (
      !user.pendingEmailNormalized ||
      !user.pendingEmailTokenHash ||
      !user.pendingEmailExpiresAt ||
      user.pendingEmailTokenHash !== hash ||
      user.pendingEmailExpiresAt <= now
    ) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        emailNormalized: user.pendingEmailNormalized,
        pendingEmailNormalized: null,
        pendingEmailTokenHash: null,
        pendingEmailExpiresAt: null,
        emailVerifiedAt: now,
        updatedAt: now,
      },
    });
    this.logger.writeEvent("INFO", "account.email_change.confirmed", {
      requestId,
      userId,
    });
  }

  async acceptLegalConsent(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
    requestId: string,
  ): Promise<void> {
    const current = await this.currentRequiredLegalVersions();
    if (termsVersion !== current.terms || privacyVersion !== current.privacy) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, "LEGAL_VERSION_STALE");
    }
    const now = new Date();
    await this.prisma.client.userLegalConsent.create({
      data: {
        id: randomUUID(),
        userId,
        termsVersion,
        privacyVersion,
        acceptedAt: now,
        createdAt: now,
      },
    });
    this.logger.writeEvent("INFO", "account.legal_consent.accepted", {
      requestId,
      userId,
    });
  }

  async requiredLegalActions(userId: string): Promise<LegalAction[]> {
    const current = await this.currentRequiredLegalVersions();
    const latest = await this.prisma.client.userLegalConsent.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
    });
    const actions: LegalAction[] = [];
    if (!latest || latest.termsVersion !== current.terms) {
      actions.push("ACCEPT_TERMS");
    }
    if (!latest || latest.privacyVersion !== current.privacy) {
      actions.push("ACCEPT_PRIVACY");
    }
    return actions;
  }

  async correctDateOfBirth(
    userId: string,
    password: string,
    dateOfBirth: string,
    requestId: string,
  ): Promise<{ accountState: AccountState; code?: string }> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const verified = await verifyPassword(password, user.passwordHash);
    if (!verified.ok) {
      throw apiError(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }
    if (user.birthDateCorrectionCount >= 1) {
      throw apiError(HttpStatus.CONFLICT, "DOB_CORRECTION_USED");
    }
    const eligible = isAgeEligibleOn(dateOfBirth);
    const accountState = eligible
      ? user.accountState
      : AccountState.AGE_INELIGIBLE;
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
        birthDateCorrectionCount: 1,
        ageEligible: eligible,
        accountState,
        updatedAt: new Date(),
      },
    });
    await this.prisma.client.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: "USER",
        actorUserId: userId,
        action: "account.date_of_birth.corrected",
        resourceType: "user",
        resourceId: userId,
        result: eligible ? "ALLOWED" : "AGE_INELIGIBLE",
        metadata: {},
        correlationId: requestId,
        createdAt: new Date(),
      },
    });
    this.logger.writeEvent("INFO", "account.dob.corrected", {
      requestId,
      userId,
    });
    return {
      accountState,
      code: eligible ? undefined : "ACCOUNT_AGE_INELIGIBLE",
    };
  }

  private async currentLegalVersions(): Promise<{
    terms: string;
    privacy: string;
  }> {
    return this.latestLegalVersions();
  }

  private async currentRequiredLegalVersions(): Promise<{
    terms: string;
    privacy: string;
  }> {
    return this.latestLegalVersions(ConsentRequirement.REQUIRED);
  }

  private async latestLegalVersions(
    requirement?: ConsentRequirement,
  ): Promise<{ terms: string; privacy: string }> {
    const docs = await this.prisma.client.legalDocument.findMany({
      where: {
        language: "en",
        ...(requirement ? { consentRequirement: requirement } : {}),
      },
      orderBy: { effectiveAt: "desc" },
    });
    const terms = docs.find((doc) => doc.documentType === "TERMS");
    const privacy = docs.find((doc) => doc.documentType === "PRIVACY");
    if (!terms || !privacy) {
      throw apiError(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
    }
    return { terms: terms.version, privacy: privacy.version };
  }

  private async noticeMinorLegalUpdates(
    userId: string,
    requestId: string,
  ): Promise<void> {
    const latest = await this.prisma.client.userLegalConsent.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
    });
    if (!latest) {
      return;
    }
    const notices = await this.prisma.client.legalDocument.findMany({
      where: {
        language: "en",
        consentRequirement: ConsentRequirement.NOTIFICATION_ONLY,
        effectiveAt: { gt: latest.acceptedAt },
      },
    });
    if (notices.length === 0) {
      return;
    }
    await this.prisma.client.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: "SYSTEM_JOB",
        actorUserId: userId,
        action: "legal.minor_update.noticed",
        resourceType: "user",
        resourceId: userId,
        result: "NOTIFIED",
        metadata: { count: notices.length },
        correlationId: requestId,
        createdAt: new Date(),
      },
    });
  }

  private async issueSession(
    userId: string,
    deviceInput: DeviceInput,
    requestId: string,
    familyId?: string,
    previousSessionId?: string,
  ): Promise<AuthResult> {
    const tokenFamilyId = familyId ?? randomUUID();
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const now = new Date();
    const device = await this.prisma.client.device.upsert({
      where: {
        userId_devicePublicId: {
          userId,
          devicePublicId: deviceInput.publicId,
        },
      },
      update: {
        deviceName: deviceInput.name,
        osVersion: deviceInput.osVersion,
        appVersion: deviceInput.appVersion,
        lastSeenAt: now,
        revokedAt: null,
        updatedAt: now,
      },
      create: {
        id: randomUUID(),
        userId,
        devicePublicId: deviceInput.publicId,
        platform: "ANDROID",
        deviceName: deviceInput.name,
        osVersion: deviceInput.osVersion,
        appVersion: deviceInput.appVersion,
        lastSeenAt: now,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    const refresh = this.tokens.issueRefreshToken();
    const sessionId = randomUUID();
    await this.prisma.client.session.create({
      data: {
        id: sessionId,
        userId,
        deviceId: device.id,
        refreshTokenHash: refresh.hash,
        tokenFamilyId,
        previousSessionId,
        expiresAt: refresh.expiresAt,
        lastUsedAt: now,
        createdAt: now,
      },
    });
    const accessToken = await this.tokens.signAccessToken({
      sub: userId,
      sid: sessionId,
      did: device.id,
    });
    return {
      accessToken,
      refreshToken: refresh.raw,
      userId,
      sessionId,
      accountState: user.accountState,
      requiredLegalActions: await this.requiredLegalActions(userId),
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function apiError(status: number, code: string): HttpException {
  return new HttpException({ code, fields: {} }, status);
}
