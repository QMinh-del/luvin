import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module";
import { OBJECT_STORAGE } from "./object-storage.port";
import { FilesystemObjectStorage } from "./filesystem-object-storage";
import { createObjectKey } from "./object-key";

const OWNER = "11111111-1111-4111-8111-111111111111";

test("signed filesystem media is readable and unsigned requests are rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "luvin-media-"));
  const moduleRef = await Test.createTestingModule({
    imports: [
      AppModule.forRoot({
        LUVIN_ENV: "production",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin",
        REDIS_URL: "redis://127.0.0.1:6379",
        ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
        OBJECT_STORAGE_BACKEND: "filesystem",
        OBJECT_STORAGE_ROOT: root,
        PUBLIC_BASE_URL: "https://api.example.com",
      }),
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  await app.init();
  const server = app.getHttpServer() as Server;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const storage = app.get(OBJECT_STORAGE);
    assert.ok(storage instanceof FilesystemObjectStorage);
    const objectKey = createObjectKey("avatar");
    await storage.put({
      purpose: "avatar",
      objectKey,
      ownerUserId: OWNER,
      contentType: "image/png",
      body: Buffer.from("png-bytes"),
    });
    const signed = new URL(
      await storage.signedGetUrl("avatar", objectKey, 900),
    );
    const ok = await fetch(
      `http://127.0.0.1:${address.port}${signed.pathname}${signed.search}`,
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await ok.arrayBuffer()).toString(), "png-bytes");

    const denied = await fetch(
      `http://127.0.0.1:${address.port}${signed.pathname}`,
    );
    assert.equal(denied.status, 404);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
