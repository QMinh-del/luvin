import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../observability/structured-logger";
import { readAppConfig } from "../config/app-config";
import { MailObservability } from "./mail-observability";

test("mail failure logs do not include recipient or reset link", () => {
  const writes: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  try {
    const config = readAppConfig({
      LUVIN_ENV: "development",
      DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_dev",
      REDIS_URL: "redis://127.0.0.1:6379",
      ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
      MINIO_ENDPOINT: "127.0.0.1:9000",
      MINIO_ACCESS_KEY: "luvin",
      MINIO_SECRET_KEY: "luvinminio",
      PASSWORD_RECOVERY_ENABLED: "true",
      RESEND_SANDBOX_API_KEY: "re_test_sandbox",
    });
    const logger = new StructuredLogger(config);
    const mail = new MailObservability(logger);
    mail.observeFailure("req-123", "password_reset");
    const payload = writes.join("");
    assert.match(payload, /mail.failed/);
    assert.match(payload, /req-123/);
    assert.equal(payload.includes("user@example.com"), false);
    assert.equal(payload.includes("https://"), false);
    assert.equal(payload.includes("re_test_sandbox"), false);
  } finally {
    process.stderr.write = original;
  }
});
