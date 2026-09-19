import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import argon2 from "argon2";
import { ConsentRequirement, LegalDocumentType } from "@prisma/client";
import { AppModule } from "../app.module";
import { MAIL_SINK, type MailSink } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { isAtLeastLockedArgon2id } from "./password-policy";

const shouldRun = process.env.RUN_INFRA_TESTS === "1";

const TEST_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "test",
  DATABASE_URL:
    "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public",
  REDIS_URL: "redis://127.0.0.1:6380",
  MINIO_ENDPOINT: "127.0.0.1:9100",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
  ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
  PASSWORD_RECOVERY_ENABLED: "true",
  RESEND_SANDBOX_API_KEY: "re_test_sandbox",
};

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
};

async function createApp(env: NodeJS.ProcessEnv = TEST_ENV): Promise<{
  app: INestApplication;
  sink: MailSink | null;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const sink = moduleRef.get<MailSink | null>(MAIL_SINK);
  const prisma = moduleRef.get(PrismaService);
  return { app, sink, prisma };
}

async function listen(app: INestApplication): Promise<number> {
  const server = app.getHttpServer() as import("node:http").Server;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

function origin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function latestLegal(prisma: PrismaService): Promise<{
  terms: string;
  privacy: string;
}> {
  const docs = await prisma.client.legalDocument.findMany({
    where: { language: "en" },
    orderBy: { effectiveAt: "desc" },
  });
  const terms = docs.find(
    (doc) => doc.documentType === LegalDocumentType.TERMS,
  );
  const privacy = docs.find(
    (doc) => doc.documentType === LegalDocumentType.PRIVACY,
  );
  assert.ok(terms && privacy);
  return { terms: terms.version, privacy: privacy.version };
}

async function registerAccount(
  port: number,
  prisma: PrismaService,
  overrides: Record<string, unknown> = {},
): Promise<{
  suffix: string;
  email: string;
  password: string;
  body: SessionPayload;
}> {
  const suffix = randomUUID().slice(0, 8);
  const email = `user_${suffix}@example.test`;
  const password = "StrongPassword1!";
  const username = `u_${suffix.replaceAll("-", "").slice(0, 14)}`;
  const legal = await latestLegal(prisma);
  const response = await fetch(`${origin(port)}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      dateOfBirth: "1990-01-01",
      username,
      displayName: "Tester",
      termsVersion: legal.terms,
      privacyVersion: legal.privacy,
      device: { publicId: `dev-${suffix}` },
      ...overrides,
    }),
  });
  const payload = (await response.json()) as {
    data?: SessionPayload;
    error?: { code: string };
  };
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.ok(payload.data);
  return { suffix, email, password, body: payload.data };
}

test(
  "registration rejects under-18 without creating a session",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const suffix = randomUUID().slice(0, 8);
    const response = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `minor_${suffix}@example.test`,
        password: "StrongPassword1!",
        dateOfBirth: "2015-01-01",
        username: `m_${suffix.slice(0, 14)}`,
        displayName: "Minor",
        termsVersion: "2026-01-01",
        privacyVersion: "2026-01-01",
        device: { publicId: `dev-minor-${suffix}` },
      }),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(response.status, 422);
    assert.equal(body.error.code, "AGE_INELIGIBLE");
    assert.equal(body.error.message.includes("2015"), false);
    await app.close();
  },
);

test(
  "login, sessions, and password-reset do not leak account existence",
  { skip: !shouldRun },
  async () => {
    const { app, sink, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const sessions = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(sessions.status, 200);
    const listed = (await sessions.json()) as { data: Array<{ id: string }> };
    assert.equal(
      listed.data.some((row) => row.id === registered.body.sessionId),
      true,
    );

    const missingReset = await fetch(
      `${origin(port)}/v1/auth/password-reset/request`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `missing_${registered.suffix}@example.test`,
        }),
      },
    );
    const knownReset = await fetch(
      `${origin(port)}/v1/auth/password-reset/request`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: registered.email }),
      },
    );
    assert.equal(missingReset.status, 202);
    assert.equal(knownReset.status, 202);
    assert.ok(sink && sink.passwordResetTokens.length === 1);
    await app.close();
  },
);

test(
  "refresh reuse revokes the token family",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const devicePublicId = `dev-${registered.suffix}`;
    const rotated = await fetch(`${origin(port)}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refreshToken: registered.body.refreshToken,
        devicePublicId,
      }),
    });
    assert.equal(rotated.status, 200);
    const reuse = await fetch(`${origin(port)}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refreshToken: registered.body.refreshToken,
        devicePublicId,
      }),
    });
    const reuseBody = (await reuse.json()) as { error: { code: string } };
    assert.equal(reuse.status, 401);
    assert.equal(reuseBody.error.code, "AUTH_REFRESH_REUSE_DETECTED");
    const protectedCall = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(protectedCall.status, 401);
    await app.close();
  },
);

test(
  "password reset is single-use and revokes sessions",
  { skip: !shouldRun },
  async () => {
    const { app, sink, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const requested = await fetch(
      `${origin(port)}/v1/auth/password-reset/request`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: registered.email }),
      },
    );
    assert.equal(requested.status, 202);
    const token = sink?.passwordResetTokens.at(-1);
    assert.ok(token);
    const confirm = await fetch(
      `${origin(port)}/v1/auth/password-reset/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "NewPassword1!" }),
      },
    );
    assert.equal(confirm.status, 204);
    const replay = await fetch(
      `${origin(port)}/v1/auth/password-reset/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "NewPassword1!" }),
      },
    );
    assert.equal(replay.status, 401);
    const sessions = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(sessions.status, 401);
    await app.close();
  },
);

test(
  "email stays active until the change is confirmed",
  { skip: !shouldRun },
  async () => {
    const { app, sink, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const nextEmail = `next_${registered.suffix}@example.test`;
    const requestChange = await fetch(
      `${origin(port)}/v1/account/email-change/request`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${registered.body.accessToken}`,
        },
        body: JSON.stringify({
          email: nextEmail,
          password: registered.password,
        }),
      },
    );
    assert.equal(requestChange.status, 202);
    const stillCurrent = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: registered.email,
        password: registered.password,
        device: { publicId: `login-${registered.suffix}` },
      }),
    });
    assert.equal(stillCurrent.status, 200);
    const pending = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: nextEmail,
        password: registered.password,
        device: { publicId: `pending-${registered.suffix}` },
      }),
    });
    assert.equal(pending.status, 401);
    const token = sink?.emailChangeTokens.at(-1);
    assert.ok(token);
    const confirm = await fetch(
      `${origin(port)}/v1/account/email-change/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${registered.body.accessToken}`,
        },
        body: JSON.stringify({ token }),
      },
    );
    assert.equal(confirm.status, 204);
    const oldLogin = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: registered.email,
        password: registered.password,
        device: { publicId: `old-${registered.suffix}` },
      }),
    });
    const newLogin = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: nextEmail,
        password: registered.password,
        device: { publicId: `new-${registered.suffix}` },
      }),
    });
    assert.equal(oldLogin.status, 401);
    assert.equal(newLogin.status, 200);
    await app.close();
  },
);

test(
  "date of birth can be corrected once and locks when ineligible",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const first = await registerAccount(port, prisma);
    const second = await registerAccount(port, prisma);
    const eligible = await fetch(`${origin(port)}/v1/account/date-of-birth`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${first.body.accessToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: "1991-02-02",
        password: first.password,
      }),
    });
    assert.equal(eligible.status, 200);
    const again = await fetch(`${origin(port)}/v1/account/date-of-birth`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${first.body.accessToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: "1992-02-02",
        password: first.password,
      }),
    });
    const againBody = (await again.json()) as { error: { code: string } };
    assert.equal(again.status, 409);
    assert.equal(againBody.error.code, "DOB_CORRECTION_USED");

    const locked = await fetch(`${origin(port)}/v1/account/date-of-birth`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${second.body.accessToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: "2015-01-01",
        password: second.password,
      }),
    });
    const lockedBody = (await locked.json()) as {
      data: { accountState: string; code: string | null };
    };
    assert.equal(locked.status, 200);
    assert.equal(lockedBody.data.accountState, "AGE_INELIGIBLE");
    assert.equal(lockedBody.data.code, "ACCOUNT_AGE_INELIGIBLE");
    const blocked = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${second.body.accessToken}` },
    });
    const blockedBody = (await blocked.json()) as { error: { code: string } };
    assert.equal(blocked.status, 403);
    assert.equal(blockedBody.error.code, "ACCOUNT_AGE_INELIGIBLE");
    await app.close();
  },
);

test(
  "registration brute force returns 429 without existence leakage",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp({
      ...TEST_ENV,
      AUTH_RATE_LIMIT_REGISTER_MAX: "2",
      AUTH_TURNSTILE_REGISTER_AFTER: "9",
    });
    const port = await listen(app);
    await registerAccount(port, prisma);
    await registerAccount(port, prisma);
    const suffix = randomUUID().slice(0, 8);
    const legal = await latestLegal(prisma);
    const limited = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `limit_${suffix}@example.test`,
        password: "StrongPassword1!",
        dateOfBirth: "1990-01-01",
        username: `l_${suffix.slice(0, 14)}`,
        displayName: "Limited",
        termsVersion: legal.terms,
        privacyVersion: legal.privacy,
        device: { publicId: `dev-limit-${suffix}` },
      }),
    });
    const body = (await limited.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(limited.status, 429);
    assert.equal(body.error.code, "RATE_LIMITED");
    assert.equal(limited.headers.get("retry-after") !== null, true);
    assert.equal(body.error.message.includes("limit_"), false);
    await app.close();
  },
);

test(
  "challenged registration requires a one-time Turnstile token",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp({
      ...TEST_ENV,
      AUTH_TURNSTILE_REGISTER_AFTER: "1",
      AUTH_RATE_LIMIT_REGISTER_MAX: "5",
    });
    const port = await listen(app);
    const suffix = randomUUID().slice(0, 8);
    const legal = await latestLegal(prisma);
    const payload = {
      email: `cap_${suffix}@example.test`,
      password: "StrongPassword1!",
      dateOfBirth: "1990-01-01",
      username: `c_${suffix.slice(0, 14)}`,
      displayName: "Captcha",
      termsVersion: legal.terms,
      privacyVersion: legal.privacy,
      device: { publicId: `dev-cap-${suffix}` },
    };
    const missing = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const missingBody = (await missing.json()) as { error: { code: string } };
    assert.equal(missing.status, 422);
    assert.equal(missingBody.error.code, "CAPTCHA_REQUIRED");
    const token = "local-turnstile-ok";
    const first = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, turnstileToken: token }),
    });
    assert.equal(first.status, 201);
    const replay = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        email: `cap2_${suffix}@example.test`,
        username: `d_${suffix.slice(0, 14)}`,
        turnstileToken: token,
      }),
    });
    const replayBody = (await replay.json()) as { error: { code: string } };
    assert.equal(replay.status, 422);
    assert.equal(replayBody.error.code, "CAPTCHA_INVALID");
    await app.close();
  },
);

test(
  "login rehashes a weaker stored Argon2id parameter set",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const weak = await argon2.hash(registered.password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    });
    assert.equal(isAtLeastLockedArgon2id(weak), false);
    await prisma.client.user.update({
      where: { id: registered.body.userId },
      data: { passwordHash: weak },
    });
    const login = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: registered.email,
        password: registered.password,
        device: { publicId: `rehash-${registered.suffix}` },
      }),
    });
    assert.equal(login.status, 200);
    const stored = await prisma.client.user.findUniqueOrThrow({
      where: { id: registered.body.userId },
    });
    assert.equal(isAtLeastLockedArgon2id(stored.passwordHash), true);
    await app.close();
  },
);

test(
  "refresh from another device is rejected and logout revokes the session",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const wrongDevice = await fetch(`${origin(port)}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refreshToken: registered.body.refreshToken,
        devicePublicId: "other-device",
      }),
    });
    assert.equal(wrongDevice.status, 401);
    const logout = await fetch(`${origin(port)}/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(logout.status, 204);
    const sessions = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(sessions.status, 401);
    await app.close();
  },
);

test(
  "owner can revoke another session and pending email tokens are not transferable",
  { skip: !shouldRun },
  async () => {
    const { app, sink, prisma } = await createApp();
    const port = await listen(app);
    const owner = await registerAccount(port, prisma);
    const other = await registerAccount(port, prisma);
    const secondLogin = await fetch(`${origin(port)}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: owner.email,
        password: owner.password,
        device: { publicId: `second-${owner.suffix}` },
      }),
    });
    const second = (await secondLogin.json()) as { data: SessionPayload };
    assert.equal(secondLogin.status, 200);
    const revoke = await fetch(
      `${origin(port)}/v1/auth/sessions/${second.data.sessionId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${owner.body.accessToken}` },
      },
    );
    assert.equal(revoke.status, 204);
    const revoked = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${second.data.accessToken}` },
    });
    assert.equal(revoked.status, 401);
    const requestChange = await fetch(
      `${origin(port)}/v1/account/email-change/request`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${owner.body.accessToken}`,
        },
        body: JSON.stringify({
          email: `steal_${owner.suffix}@example.test`,
          password: owner.password,
        }),
      },
    );
    assert.equal(requestChange.status, 202);
    const stolen = sink?.emailChangeTokens.at(-1);
    assert.ok(stolen);
    const confirm = await fetch(
      `${origin(port)}/v1/account/email-change/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${other.body.accessToken}`,
        },
        body: JSON.stringify({ token: stolen }),
      },
    );
    assert.equal(confirm.status, 401);
    await app.close();
  },
);

test(
  "material legal update blocks protected access until consent",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const version = `v${registered.suffix}${randomUUID().slice(0, 8)}`;
    const now = new Date();
    await prisma.client.legalDocument.createMany({
      data: [
        {
          id: randomUUID(),
          documentType: LegalDocumentType.TERMS,
          version,
          language: "en",
          contentUri: "test://legal/terms",
          contentHash: "sha256:test-terms",
          effectiveAt: now,
          consentRequirement: ConsentRequirement.REQUIRED,
          createdAt: now,
        },
        {
          id: randomUUID(),
          documentType: LegalDocumentType.PRIVACY,
          version,
          language: "en",
          contentUri: "test://legal/privacy",
          contentHash: "sha256:test-privacy",
          effectiveAt: now,
          consentRequirement: ConsentRequirement.REQUIRED,
          createdAt: now,
        },
      ],
    });
    const blocked = await fetch(
      `${origin(port)}/v1/account/email-change/request`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${registered.body.accessToken}`,
        },
        body: JSON.stringify({
          email: `legal_${registered.suffix}@example.test`,
          password: registered.password,
        }),
      },
    );
    const blockedBody = (await blocked.json()) as { error: { code: string } };
    assert.equal(blocked.status, 403);
    assert.equal(blockedBody.error.code, "LEGAL_CONSENT_REQUIRED");
    const accept = await fetch(`${origin(port)}/v1/account/legal-consent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${registered.body.accessToken}`,
      },
      body: JSON.stringify({
        termsVersion: version,
        privacyVersion: version,
      }),
    });
    assert.equal(accept.status, 204);
    const sessions = await fetch(`${origin(port)}/v1/auth/sessions`, {
      headers: { authorization: `Bearer ${registered.body.accessToken}` },
    });
    assert.equal(sessions.status, 200);
    await app.close();
  },
);

test(
  "register rejects weak passwords and duplicate normalized email",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp({
      ...TEST_ENV,
      AUTH_TURNSTILE_REGISTER_AFTER: "9",
      AUTH_RATE_LIMIT_REGISTER_MAX: "10",
    });
    const port = await listen(app);
    const legal = await latestLegal(prisma);
    const suffix = randomUUID().slice(0, 8);
    const weak = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `weak_${suffix}@example.test`,
        password: "short1!",
        dateOfBirth: "1990-01-01",
        username: `w_${suffix.slice(0, 14)}`,
        displayName: "Weak",
        termsVersion: legal.terms,
        privacyVersion: legal.privacy,
        device: { publicId: `dev-weak-${suffix}` },
      }),
    });
    const weakBody = (await weak.json()) as { error: { code: string } };
    assert.equal(weak.status, 422);
    assert.equal(weakBody.error.code, "PASSWORD_TOO_SHORT");
    const first = await registerAccount(port, prisma);
    const duplicate = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: first.email.toUpperCase(),
        password: "StrongPassword1!",
        dateOfBirth: "1990-01-01",
        username: `dup_${suffix.slice(0, 12)}`,
        displayName: "Dup",
        termsVersion: legal.terms,
        privacyVersion: legal.privacy,
        device: { publicId: `dev-dup-${suffix}` },
      }),
    });
    const dupBody = (await duplicate.json()) as { error: { code: string } };
    assert.equal(duplicate.status, 409);
    assert.equal(dupBody.error.code, "EMAIL_UNAVAILABLE");
    const category = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `cat_${suffix}@example.test`,
        password: "NoSpecials12A",
        dateOfBirth: "1990-01-01",
        username: `cat_${suffix.slice(0, 12)}`,
        displayName: "Cat",
        termsVersion: legal.terms,
        privacyVersion: legal.privacy,
        device: { publicId: `dev-cat-${suffix}` },
      }),
    });
    const categoryBody = (await category.json()) as { error: { code: string } };
    assert.equal(category.status, 422);
    assert.equal(categoryBody.error.code, "PASSWORD_CATEGORY_MISSING");
    const usernameClash = await fetch(`${origin(port)}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `name_${suffix}@example.test`,
        password: "StrongPassword1!",
        dateOfBirth: "1990-01-01",
        username: `u_${first.suffix}`,
        displayName: "Name",
        termsVersion: legal.terms,
        privacyVersion: legal.privacy,
        device: { publicId: `dev-name-${suffix}` },
      }),
    });
    const nameBody = (await usernameClash.json()) as {
      error: { code: string };
    };
    assert.equal(usernameClash.status, 409);
    assert.equal(nameBody.error.code, "USERNAME_UNAVAILABLE");
    await app.close();
  },
);

test(
  "login brute force returns the same 429 envelope",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp({
      ...TEST_ENV,
      AUTH_RATE_LIMIT_LOGIN_MAX: "2",
      AUTH_TURNSTILE_LOGIN_AFTER: "9",
    });
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const attempt = async () =>
      fetch(`${origin(port)}/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: registered.email,
          password: "WrongPassword1!",
          device: { publicId: `bf-${registered.suffix}` },
        }),
      });
    const first = await attempt();
    const second = await attempt();
    const third = await attempt();
    assert.equal(first.status, 401);
    assert.equal(second.status, 401);
    assert.equal(third.status, 429);
    const body = (await third.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(body.error.code, "RATE_LIMITED");
    assert.equal(body.error.message.includes(registered.email), false);
    await app.close();
  },
);

test(
  "password-reset and email-change brute force return 429",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp({
      ...TEST_ENV,
      AUTH_RATE_LIMIT_PASSWORD_RESET_MAX: "2",
      AUTH_TURNSTILE_PASSWORD_RESET_AFTER: "9",
      AUTH_RATE_LIMIT_EMAIL_CHANGE_MAX: "2",
    });
    const port = await listen(app);
    const registered = await registerAccount(port, prisma);
    const reset = async () =>
      fetch(`${origin(port)}/v1/auth/password-reset/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: registered.email }),
      });
    assert.equal((await reset()).status, 202);
    assert.equal((await reset()).status, 202);
    const resetLimited = await reset();
    assert.equal(resetLimited.status, 429);
    const change = async () =>
      fetch(`${origin(port)}/v1/account/email-change/request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${registered.body.accessToken}`,
        },
        body: JSON.stringify({
          email: `chg_${registered.suffix}@example.test`,
          password: registered.password,
        }),
      });
    assert.equal((await change()).status, 202);
    assert.equal((await change()).status, 202);
    const changeLimited = await change();
    assert.equal(changeLimited.status, 429);
    await app.close();
  },
);
