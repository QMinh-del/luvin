import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { readAppConfig } from "../config/app-config";
import { MemoryCounterStore } from "./counter-store";
import { TurnstileService } from "./turnstile.service";

const CONFIG = readAppConfig({
  LUVIN_ENV: "test",
  DATABASE_URL:
    "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public",
  REDIS_URL: "redis://127.0.0.1:6380",
  MINIO_ENDPOINT: "127.0.0.1:9100",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
  ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
});

test("does not require a token until challenged", async () => {
  const service = new TurnstileService(CONFIG, new MemoryCounterStore());
  await service.enforce({
    challenged: false,
    token: undefined,
    action: "register",
    ip: "127.0.0.1",
  });
});

test("requires a token when challenged", async () => {
  const service = new TurnstileService(CONFIG, new MemoryCounterStore());
  await assert.rejects(
    () =>
      service.enforce({
        challenged: true,
        token: undefined,
        action: "register",
        ip: "127.0.0.1",
      }),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 422,
  );
});

test("rejects reused tokens for the same action", async () => {
  const service = new TurnstileService(CONFIG, new MemoryCounterStore());
  const token = "local-turnstile-ok";
  await service.enforce({
    challenged: true,
    token,
    action: "register",
    ip: "127.0.0.1",
  });
  await assert.rejects(
    () =>
      service.enforce({
        challenged: true,
        token,
        action: "register",
        ip: "127.0.0.1",
      }),
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      const payload = error instanceof HttpException ? error.getResponse() : {};
      assert.equal(
        typeof payload === "object" &&
          payload !== null &&
          "code" in payload &&
          payload.code === "CAPTCHA_INVALID",
        true,
      );
      return true;
    },
  );
});

test("rejects a token that was already used for another action", async () => {
  const store = new MemoryCounterStore();
  const service = new TurnstileService(CONFIG, store);
  const token = "local-turnstile-ok";
  await service.enforce({
    challenged: true,
    token,
    action: "register",
    ip: "127.0.0.1",
  });
  await assert.rejects(
    () =>
      service.enforce({
        challenged: true,
        token,
        action: "login",
        ip: "127.0.0.1",
      }),
    (error: unknown) => error instanceof HttpException,
  );
});
