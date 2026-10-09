import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { AccountState } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

export type AuthContext = {
  userId: string;
  sessionId: string;
  deviceId: string;
};

@Injectable()
export class AccessAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new HttpException(
        { code: "AUTH_INVALID_CREDENTIALS", fields: {} },
        HttpStatus.UNAUTHORIZED,
      );
    }
    let claims;
    try {
      claims = await this.tokens.verifyAccessToken(token);
    } catch {
      throw new HttpException(
        { code: "AUTH_INVALID_CREDENTIALS", fields: {} },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const session = await this.prisma.client.session.findUnique({
      where: { id: claims.sid },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.userId !== claims.sub
    ) {
      throw new HttpException(
        { code: "AUTH_INVALID_CREDENTIALS", fields: {} },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const user = await this.prisma.client.user.findUnique({
      where: { id: claims.sub },
    });
    if (!user) {
      throw new HttpException(
        { code: "AUTH_INVALID_CREDENTIALS", fields: {} },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const path = request.originalUrl.split("?")[0] ?? "";
    if (user.accountState === AccountState.PENDING_DELETION) {
      if (!isDeletionCancellation(request.method, path)) {
        throw accountStateError("ACCOUNT_PENDING_DELETION");
      }
    }
    if (
      user.accountState === AccountState.AGE_INELIGIBLE &&
      !isAgeIneligiblePath(path)
    ) {
      throw new HttpException(
        { code: "ACCOUNT_AGE_INELIGIBLE", fields: {} },
        HttpStatus.FORBIDDEN,
      );
    }
    if (user.accountState !== AccountState.AGE_INELIGIBLE) {
      const legal = await this.auth.requiredLegalActions(user.id);
      if (legal.length > 0 && !isConsentAllowedPath(path)) {
        throw new HttpException(
          { code: "LEGAL_CONSENT_REQUIRED", fields: {} },
          HttpStatus.FORBIDDEN,
        );
      }
    }
    if (
      user.accountState === AccountState.SUSPENDED ||
      user.accountState === AccountState.DELETED
    ) {
      throw accountStateError("ACCOUNT_ACCESS_RESTRICTED");
    }
    request.auth = {
      userId: claims.sub,
      sessionId: claims.sid,
      deviceId: claims.did,
    };
    return true;
  }
}

function accountStateError(code: string): HttpException {
  return new HttpException({ code, fields: {} }, HttpStatus.FORBIDDEN);
}

function isAgeIneligiblePath(path: string): boolean {
  return (
    path.startsWith("/v1/account/deletion") ||
    path.startsWith("/v1/account/export") ||
    path.startsWith("/v1/account/exports")
  );
}

function isConsentAllowedPath(path: string): boolean {
  return (
    path === "/v1/account/legal-consent" ||
    path === "/v1/auth/logout" ||
    path.startsWith("/v1/auth/sessions") ||
    isAgeIneligiblePath(path)
  );
}

function isDeletionCancellation(method: string, path: string): boolean {
  return method === "DELETE" && path === "/v1/account/deletion";
}
