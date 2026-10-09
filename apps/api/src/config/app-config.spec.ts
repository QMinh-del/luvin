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
  ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
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
        ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
        MINIO_ENDPOINT: "127.0.0.1:9000",
        MINIO_ACCESS_KEY: "luvin",
        MINIO_SECRET_KEY: "luvinminio",
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
    ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
    MINIO_ENDPOINT: "127.0.0.1:9000",
    MINIO_ACCESS_KEY: "luvin",
    MINIO_SECRET_KEY: "luvinminio",
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
        ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
        GOOGLE_CLOUD_PROJECT: "luvin-prod",
        GCS_AVATAR_BUCKET: "luvin-prod-avatars",
        GCS_EXPORT_BUCKET: "luvin-prod-exports",
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

test("uses MinIO object storage in local environments", () => {
  const config = readAppConfig(LOCAL_BASE);
  assert.equal(config.objectStorage.backend, "minio");
  if (config.objectStorage.backend === "minio") {
    assert.equal(config.objectStorage.avatarBucket, "luvin-local-avatars");
  }
  assert.equal(publicAppConfig(config).objectStorageBackend, "minio");
});

test("requires private GCS buckets in production", () => {
  assert.throws(
    () =>
      readAppConfig({
        LUVIN_ENV: "production",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_prod",
        REDIS_URL: "redis://127.0.0.1:6379",
        ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
        GOOGLE_CLOUD_PROJECT: "luvin-prod",
      }),
    /GCS_AVATAR_BUCKET/,
  );
});

test("Botkeep SERVER_PORT overrides PORT", () => {
  const config = readAppConfig({
    ...LOCAL_BASE,
    PORT: "3000",
    SERVER_PORT: "4321",
  });
  assert.equal(config.port, 4321);
});

test("production filesystem storage does not require Google Cloud", () => {
  const config = readAppConfig({
    LUVIN_ENV: "production",
    DATABASE_URL: "postgresql://luvin:pw@db.internal:5432/luvin",
    REDIS_URL: "rediss://default:pw@redis.internal:6379",
    ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
    OBJECT_STORAGE_BACKEND: "filesystem",
    PUBLIC_BASE_URL: "https://api.example.com/",
    DATABASE_SSL_CA:
      "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
    REDIS_SSL_CA:
      "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
    PASSWORD_RECOVERY_ENABLED: "false",
  });
  assert.equal(config.objectStorage.backend, "filesystem");
  assert.equal(config.port, 3000);
  if (config.objectStorage.backend === "filesystem") {
    assert.equal(config.objectStorage.publicBaseUrl, "https://api.example.com");
    assert.equal(config.objectStorage.root, "/app/data/objects");
  }
  const published = JSON.stringify(publicAppConfig(config));
  assert.equal(published.includes("BEGIN CERTIFICATE"), false);
  assert.equal(published.includes("local-test-access-token"), false);
  assert.equal(published.includes("postgresql://"), false);
});

test("uses Google Cloud Storage in production when buckets are configured", () => {
  const config = readAppConfig({
    LUVIN_ENV: "production",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_prod",
    REDIS_URL: "redis://127.0.0.1:6379",
    ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
    GOOGLE_CLOUD_PROJECT: "luvin-prod",
    GCS_AVATAR_BUCKET: "luvin-prod-avatars",
    GCS_EXPORT_BUCKET: "luvin-prod-exports",
  });
  assert.equal(config.objectStorage.backend, "gcs");
  assert.equal(publicAppConfig(config).objectStorageBackend, "gcs");
  assert.equal(
    JSON.stringify(publicAppConfig(config)).includes("luvinminio"),
    false,
  );
});
