import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigValidationError,
  publicAppConfig,
  readAppConfig,
} from "./app-config";

const LOCAL_BASE: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

test("fails fast when required local variables are missing", () => {
  assert.throws(
    () => readAppConfig({ LUVIN_ENV: "local" }),
    ConfigValidationError,
  );
});

test("rejects unknown LUVIN_ENV", () => {
  assert.throws(
    () => readAppConfig({ ...LOCAL_BASE, LUVIN_ENV: "prod" }),
    /LUVIN_ENV must be local/,
  );
});

test("reads local configuration without exposing secrets in public view", () => {
  const config = readAppConfig(LOCAL_BASE);
  const published = publicAppConfig(config);
  assert.equal(config.luvinEnv, "local");
  assert.equal(published.resendMode, "disabled");
  assert.equal(JSON.stringify(published).includes("luvinminio"), false);
  assert.equal(JSON.stringify(published).includes("postgresql://"), false);
});

test("requires sandbox Resend when recovery is enabled in development", () => {
  assert.throws(
    () =>
      readAppConfig({
        LUVIN_ENV: "development",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_dev",
        REDIS_URL: "redis://127.0.0.1:6379",
        PASSWORD_RECOVERY_ENABLED: "true",
      }),
    /RESEND_SANDBOX_API_KEY/,
  );
});

test("uses sandbox Resend in development when recovery is enabled", () => {
  const config = readAppConfig({
    LUVIN_ENV: "development",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_dev",
    REDIS_URL: "redis://127.0.0.1:6379",
    PASSWORD_RECOVERY_ENABLED: "true",
    RESEND_SANDBOX_API_KEY: "re_test_sandbox",
  });
  assert.equal(config.resend.mode, "sandbox");
});

test("rejects production Resend keys in local environments", () => {
  assert.throws(
    () =>
      readAppConfig({
        ...LOCAL_BASE,
        RESEND_PRODUCTION_API_KEY: "re_prod",
      }),
    /must not be loaded outside staging or production/,
  );
});

test("fails production startup when recovery is enabled without a verified sender", () => {
  assert.throws(
    () =>
      readAppConfig({
        LUVIN_ENV: "production",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_prod",
        REDIS_URL: "redis://127.0.0.1:6379",
        GOOGLE_CLOUD_PROJECT: "luvin-prod",
        PASSWORD_RECOVERY_ENABLED: "true",
        RESEND_PRODUCTION_API_KEY: "re_prod",
        RESEND_PRODUCTION_FROM: "noreply@example.com",
        RESEND_PRODUCTION_DOMAIN_VERIFIED: "false",
      }),
    /verified Resend sender domain/,
  );
});

test("requires Google Cloud project in production", () => {
  assert.throws(
    () =>
      readAppConfig({
        LUVIN_ENV: "production",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_prod",
        REDIS_URL: "redis://127.0.0.1:6379",
      }),
    /GOOGLE_CLOUD_PROJECT/,
  );
});
