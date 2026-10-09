import { HttpException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../observability/structured-logger";
import { readAppConfig } from "../config/app-config";
import { MemoryObjectStorage } from "./memory-object-storage";
import { ObjectStorageService } from "./object-storage.service";
import {
  AVATAR_SIGNED_URL_SECONDS,
  EXPORT_SIGNED_URL_SECONDS,
} from "./object-storage.port";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function service(storage = new MemoryObjectStorage()) {
  const audits: unknown[] = [];
  const config = readAppConfig({
    LUVIN_ENV: "local",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
    REDIS_URL: "redis://127.0.0.1:6379",
    MINIO_ENDPOINT: "127.0.0.1:9000",
    MINIO_ACCESS_KEY: "luvin",
    MINIO_SECRET_KEY: "luvinminio",
    ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
  });
  const prisma = {
    client: {
      auditLog: {
        create: async (args: unknown) => {
          audits.push(args);
          return args;
        },
      },
    },
  };
  return {
    storage,
    audits,
    svc: new ObjectStorageService(
      storage,
      prisma as never,
      new StructuredLogger(config),
    ),
  };
}

test("enforces content-length limits", async () => {
  const { svc } = service();
  await assert.rejects(
    () =>
      svc.putOwned({
        purpose: "avatar",
        ownerUserId: OWNER,
        contentType: "image/jpeg",
        body: Buffer.alloc(0),
        requestId: "req-empty",
      }),
    HttpException,
  );
});

test("owner can sign a short-lived avatar URL and another user cannot", async () => {
  const { svc, audits } = service();
  const stored = await svc.putOwned({
    purpose: "avatar",
    ownerUserId: OWNER,
    contentType: "image/jpeg",
    body: Buffer.from("jpeg-bytes"),
    requestId: "req-put",
  });
  const signed = await svc.signedReadUrl({
    purpose: "avatar",
    objectKey: stored.objectKey,
    requesterUserId: OWNER,
    requestId: "req-get",
  });
  assert.equal(signed.expiresSeconds, AVATAR_SIGNED_URL_SECONDS);
  assert.equal(signed.url.includes("jpeg-bytes"), false);
  await assert.rejects(
    () =>
      svc.signedReadUrl({
        purpose: "avatar",
        objectKey: stored.objectKey,
        requesterUserId: OTHER,
        requestId: "req-idor",
      }),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 404,
  );
  await assert.rejects(
    () =>
      svc.deleteOwned({
        purpose: "avatar",
        objectKey: stored.objectKey,
        requesterUserId: OTHER,
        requestId: "req-delete-idor",
      }),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 404,
  );
  assert.equal(JSON.stringify(audits).includes("jpeg-bytes"), false);
});

test("deleted avatars stop resolving and cleanup removes the object", async () => {
  const { svc, storage } = service();
  const stored = await svc.putOwned({
    purpose: "avatar",
    ownerUserId: OWNER,
    contentType: "image/jpeg",
    body: Buffer.from("avatar"),
    requestId: "req-del",
  });
  await svc.deleteOwned({
    purpose: "avatar",
    objectKey: stored.objectKey,
    requesterUserId: OWNER,
    requestId: "req-del-2",
  });
  await assert.rejects(
    () =>
      svc.signedReadUrl({
        purpose: "avatar",
        objectKey: stored.objectKey,
        requesterUserId: OWNER,
        requestId: "req-after-del",
      }),
    HttpException,
  );
  const purged = await svc.purgeDue(new Date(), "req-purge");
  assert.equal(purged, 1);
  assert.equal(await storage.head("avatar", stored.objectKey), undefined);
});

test("expired export objects are purged after 24 hours", async () => {
  const { svc, storage } = service();
  const stored = await svc.putOwned({
    purpose: "export",
    ownerUserId: OWNER,
    contentType: "application/zip",
    body: Buffer.from("zip"),
    requestId: "req-export",
  });
  const signed = await svc.signedReadUrl({
    purpose: "export",
    objectKey: stored.objectKey,
    requesterUserId: OWNER,
    requestId: "req-export-get",
  });
  assert.equal(signed.expiresSeconds, EXPORT_SIGNED_URL_SECONDS);
  const later = new Date(Date.now() + EXPORT_SIGNED_URL_SECONDS * 1000);
  const purged = await svc.purgeDue(later, "req-export-purge");
  assert.equal(purged, 1);
  assert.equal(await storage.head("export", stored.objectKey), undefined);
});
