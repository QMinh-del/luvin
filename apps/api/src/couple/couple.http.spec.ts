import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { LegalDocumentType, LocationMode } from "@prisma/client";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

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
  userId: string;
};

type CoupleBody = {
  connectionId: string;
  state: string;
  invitationId: string | null;
  partners: Array<{
    userId: string;
    username: string;
    displayName: string;
    membershipState: string;
    email?: string;
    role?: string;
  }>;
};

async function createApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(TEST_ENV)],
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
  return { app, prisma: moduleRef.get(PrismaService) };
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

async function register(
  port: number,
  prisma: PrismaService,
  label: string,
): Promise<{ username: string; email: string; session: SessionPayload }> {
  const suffix = randomUUID().slice(0, 8);
  const username = `${label}_${suffix}`.slice(0, 20);
  const email = `${username}@example.test`;
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
  const response = await fetch(`${origin(port)}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "StrongPassword1!",
      dateOfBirth: "1990-01-01",
      username,
      displayName: label,
      termsVersion: terms.version,
      privacyVersion: privacy.version,
      device: { publicId: `dev-${suffix}` },
    }),
  });
  const payload = (await response.json()) as { data?: SessionPayload };
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.ok(payload.data);
  return { username, email, session: payload.data };
}

async function coupleRequest(
  port: number,
  token: string,
  username: string,
  key = randomUUID(),
): Promise<Response> {
  return fetch(`${origin(port)}/v1/connections/couple-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "idempotency-key": key,
    },
    body: JSON.stringify({ username }),
  });
}

test(
  "couple request, accept, block, and disconnect keep chat history and delete locations",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const alpha = await register(port, prisma, "alpha");
    const beta = await register(port, prisma, "beta");
    const key = randomUUID();

    const created = await coupleRequest(
      port,
      alpha.session.accessToken,
      beta.username,
      key,
    );
    const createdBody = (await created.json()) as { data: CoupleBody };
    assert.equal(created.status, 200);
    assert.equal(createdBody.data.state, "PENDING");
    assert.equal(createdBody.data.partners.length, 2);
    assert.equal(JSON.stringify(createdBody).includes(beta.email), false);
    assert.equal(JSON.stringify(createdBody).includes("role"), false);

    const replay = await coupleRequest(
      port,
      alpha.session.accessToken,
      beta.username,
      key,
    );
    const replayBody = (await replay.json()) as { data: CoupleBody };
    assert.equal(replay.status, 200);
    assert.equal(replayBody.data.connectionId, createdBody.data.connectionId);

    const reused = await coupleRequest(
      port,
      alpha.session.accessToken,
      "other_name",
      key,
    );
    const reusedBody = (await reused.json()) as { error: { code: string } };
    assert.equal(reused.status, 409);
    assert.equal(reusedBody.error.code, "IDEMPOTENCY_KEY_REUSED");

    const self = await coupleRequest(
      port,
      alpha.session.accessToken,
      alpha.username,
    );
    const selfBody = (await self.json()) as { error: { code: string } };
    assert.equal(self.status, 409);
    assert.equal(selfBody.error.code, "COUPLE_SELF");

    const missing = await coupleRequest(
      port,
      alpha.session.accessToken,
      "missing_user",
    );
    const missingText = await missing.text();
    assert.equal(missing.status, 404);
    assert.equal(missingText.includes("@"), false);

    const invitationId = createdBody.data.invitationId;
    assert.ok(invitationId);
    const accepted = await fetch(
      `${origin(port)}/v1/connection-invitations/${invitationId}/accept`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${beta.session.accessToken}`,
          "idempotency-key": randomUUID(),
        },
      },
    );
    const acceptedBody = (await accepted.json()) as { data: CoupleBody };
    assert.equal(accepted.status, 200);
    assert.equal(acceptedBody.data.state, "ACTIVE");
    const conversations = await prisma.client.conversation.findMany({
      where: { connectionId: acceptedBody.data.connectionId },
    });
    assert.equal(conversations.length, 1);
    const messageId = randomUUID();
    await prisma.client.message.create({
      data: {
        id: messageId,
        conversationId: conversations[0].id,
        senderUserId: alpha.session.userId,
        clientMessageId: randomUUID(),
        bodyText: "keep-this-history",
        serverSequence: 1n,
        createdAt: new Date(),
      },
    });
    const device = await prisma.client.device.findFirstOrThrow({
      where: { userId: alpha.session.userId },
    });
    await prisma.client.location.create({
      data: {
        id: randomUUID(),
        userId: alpha.session.userId,
        connectionId: acceptedBody.data.connectionId,
        deviceId: device.id,
        capturedAt: new Date(),
        receivedAt: new Date(),
        latitude: 10.123456,
        longitude: 106.123456,
        accuracyMeters: 12.5,
        sourceIsBackground: false,
        modeAtCapture: LocationMode.LIVE,
        sequence: 1n,
        createdAt: new Date(),
      },
    });
    await prisma.client.locationViewerGrant.create({
      data: {
        id: randomUUID(),
        connectionId: acceptedBody.data.connectionId,
        ownerUserId: alpha.session.userId,
        viewerUserId: beta.session.userId,
        grantedAt: new Date(),
      },
    });

    const blocked = await fetch(`${origin(port)}/v1/blocks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${alpha.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ targetUserId: beta.session.userId }),
    });
    assert.equal(blocked.status, 200);
    const stillActive = await prisma.client.connection.findUniqueOrThrow({
      where: { id: acceptedBody.data.connectionId },
    });
    assert.equal(stillActive.state, "ACTIVE");

    const disconnected = await fetch(
      `${origin(port)}/v1/connections/${acceptedBody.data.connectionId}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${alpha.session.accessToken}`,
          "idempotency-key": randomUUID(),
        },
      },
    );
    const disconnectedBody = (await disconnected.json()) as {
      data: CoupleBody;
    };
    assert.equal(disconnected.status, 200);
    assert.equal(disconnectedBody.data.state, "DISCONNECTED");
    assert.equal(
      await prisma.client.location.count({
        where: { connectionId: acceptedBody.data.connectionId },
      }),
      0,
    );
    assert.equal(
      await prisma.client.locationViewerGrant.count({
        where: { connectionId: acceptedBody.data.connectionId },
      }),
      0,
    );
    const retained = await prisma.client.message.findUnique({
      where: { id: messageId },
    });
    assert.equal(retained?.bodyText, "keep-this-history");

    const afterBlock = await coupleRequest(
      port,
      alpha.session.accessToken,
      beta.username,
    );
    const afterBlockBody = (await afterBlock.json()) as {
      error: { code: string };
    };
    assert.equal(afterBlock.status, 403);
    assert.equal(afterBlockBody.error.code, "COUPLE_BLOCKED");
    await app.close();
  },
);

test(
  "a pairing code is single use, expires, and does not grant location or bypass a block",
  { skip: !shouldRun },
  async () => {
    const { app, prisma } = await createApp();
    const port = await listen(app);
    const owner = await register(port, prisma, "owner");
    const partner = await register(port, prisma, "mate");

    const partnerCode = await fetch(`${origin(port)}/v1/me/pairing-codes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${partner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
    });
    assert.equal(partnerCode.status, 200);

    const created = await fetch(`${origin(port)}/v1/me/pairing-codes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
    });
    const createdBody = (await created.json()) as {
      data: { code: string; expiresAt: string };
    };
    assert.equal(created.status, 200);
    assert.match(
      createdBody.data.code,
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,
    );
    const stored = await prisma.client.pairingCode.findFirstOrThrow({
      where: { ownerUserId: owner.session.userId },
    });
    assert.equal(stored.codeHash.includes(createdBody.data.code), false);

    const current = await fetch(`${origin(port)}/v1/me/pairing-codes/current`, {
      headers: { authorization: `Bearer ${owner.session.accessToken}` },
    });
    const currentBody = (await current.json()) as {
      data: { active: boolean; code?: string };
    };
    assert.equal(current.status, 200);
    assert.equal(currentBody.data.active, true);
    assert.equal(currentBody.data.code, undefined);

    const self = await fetch(`${origin(port)}/v1/pairing-codes/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ code: createdBody.data.code }),
    });
    const selfBody = (await self.json()) as { error: { code: string } };
    assert.equal(self.status, 409);
    assert.equal(selfBody.error.code, "COUPLE_SELF");

    const redeemed = await fetch(`${origin(port)}/v1/pairing-codes/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${partner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ code: createdBody.data.code.toLowerCase() }),
    });
    const redeemedBody = (await redeemed.json()) as { data: CoupleBody };
    assert.equal(redeemed.status, 200);
    assert.equal(redeemedBody.data.state, "PENDING");
    assert.equal(
      await prisma.client.locationViewerGrant.count({
        where: { connectionId: redeemedBody.data.connectionId },
      }),
      0,
    );
    const revokedPartnerCode = await prisma.client.pairingCode.findFirstOrThrow(
      {
        where: { ownerUserId: partner.session.userId },
      },
    );
    assert.ok(revokedPartnerCode.revokedAt);
    const invitee = redeemedBody.data.partners.find(
      (item) => item.userId === partner.session.userId,
    );
    assert.equal(invitee?.membershipState, "INVITED");

    const again = await fetch(`${origin(port)}/v1/pairing-codes/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${partner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ code: createdBody.data.code }),
    });
    const againBody = (await again.json()) as { error: { code: string } };
    assert.equal(again.status, 404);
    assert.equal(againBody.error.code, "PAIRING_CODE_INVALID");

    await prisma.client.connectionPartner.updateMany({
      where: { connectionId: redeemedBody.data.connectionId },
      data: { state: "LEFT", leftAt: new Date() },
    });
    await prisma.client.connection.update({
      where: { id: redeemedBody.data.connectionId },
      data: { state: "DISCONNECTED", disconnectedAt: new Date() },
    });

    const blockedCode = await fetch(`${origin(port)}/v1/me/pairing-codes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
    });
    const blockedCodeBody = (await blockedCode.json()) as {
      data: { code: string };
    };
    assert.equal(blockedCode.status, 200);
    await fetch(`${origin(port)}/v1/blocks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ targetUserId: partner.session.userId }),
    });
    const blockedRedeem = await fetch(
      `${origin(port)}/v1/pairing-codes/redeem`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${partner.session.accessToken}`,
          "idempotency-key": randomUUID(),
        },
        body: JSON.stringify({ code: blockedCodeBody.data.code }),
      },
    );
    const blockedRedeemBody = (await blockedRedeem.json()) as {
      error: { code: string };
    };
    assert.equal(blockedRedeem.status, 403);
    assert.equal(blockedRedeemBody.error.code, "COUPLE_BLOCKED");
    const stillOpen = await prisma.client.pairingCode.findFirstOrThrow({
      where: {
        ownerUserId: owner.session.userId,
        consumedAt: null,
        revokedAt: null,
      },
    });
    await prisma.client.pairingCode.update({
      where: { id: stillOpen.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await fetch(`${origin(port)}/v1/pairing-codes/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${partner.session.accessToken}`,
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ code: blockedCodeBody.data.code }),
    });
    const expiredBody = (await expired.json()) as { error: { code: string } };
    assert.equal(expired.status, 404);
    assert.equal(expiredBody.error.code, "PAIRING_CODE_INVALID");
    await app.close();
  },
);
