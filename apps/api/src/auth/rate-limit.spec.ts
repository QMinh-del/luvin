import assert from "node:assert/strict";
import test from "node:test";
import { HttpException, HttpStatus } from "@nestjs/common";
import { readAppConfig } from "../config/app-config";
import { MemoryCounterStore } from "./counter-store";
import { RateLimitService } from "./rate-limit.service";

const CONFIG = readAppConfig({
  LUVIN_ENV: "test",
  DATABASE_URL:
    "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public",
  REDIS_URL: "redis://127.0.0.1:6380",
  MINIO_ENDPOINT: "127.0.0.1:9100",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
  ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
  AUTH_RATE_LIMIT_REGISTER_MAX: "10",
});

test("allows ten registration attempts and rate-limits the eleventh", async () => {
  const service = new RateLimitService(CONFIG, new MemoryCounterStore());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await service.consume("register", "10.0.0.1");
  }
  await assert.rejects(
    () => service.consume("register", "10.0.0.1"),
    (error: unknown) =>
      error instanceof HttpException &&
      error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
});
