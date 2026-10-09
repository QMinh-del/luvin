import assert from "node:assert/strict";
import test from "node:test";
import {
  bucketsForEnv,
  readLocalServicesConfig,
} from "./local-services-config";

test("uses isolated local and test bucket names", () => {
  assert.deepEqual(bucketsForEnv("local"), {
    avatar: "luvin-local-avatars",
    export: "luvin-local-exports",
  });
  assert.deepEqual(bucketsForEnv("test"), {
    avatar: "luvin-test-avatars",
    export: "luvin-test-exports",
  });
});

test("reads local discovery settings from environment", () => {
  const config = readLocalServicesConfig({
    LUVIN_ENV: "local",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
    REDIS_URL: "redis://127.0.0.1:6379",
    MINIO_ENDPOINT: "127.0.0.1:9000",
    MINIO_ACCESS_KEY: "luvin",
    MINIO_SECRET_KEY: "luvinminio",
  });
  assert.equal(config.avatarBucket, "luvin-local-avatars");
  assert.equal(config.exportBucket, "luvin-local-exports");
  assert.equal(config.minioEndPoint, "127.0.0.1");
  assert.equal(config.minioPort, 9000);
  assert.equal(config.minioUseSSL, false);
});

test("rejects production-like LUVIN_ENV for local infrastructure", () => {
  assert.throws(
    () =>
      readLocalServicesConfig({
        LUVIN_ENV: "production",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
        REDIS_URL: "redis://127.0.0.1:6379",
        MINIO_ENDPOINT: "127.0.0.1:9000",
        MINIO_ACCESS_KEY: "luvin",
        MINIO_SECRET_KEY: "luvinminio",
      }),
    /LUVIN_ENV must be local or test/,
  );
});

test("rejects unsupported or ambiguous MinIO endpoints", () => {
  const baseEnv: NodeJS.ProcessEnv = {
    LUVIN_ENV: "local",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
    REDIS_URL: "redis://127.0.0.1:6379",
    MINIO_ACCESS_KEY: "luvin",
    MINIO_SECRET_KEY: "luvinminio",
  };

  assert.throws(
    () =>
      readLocalServicesConfig({
        ...baseEnv,
        MINIO_ENDPOINT: "ftp://127.0.0.1:9000",
      }),
    /MINIO_ENDPOINT must use http or https/,
  );
  assert.throws(
    () =>
      readLocalServicesConfig({
        ...baseEnv,
        MINIO_ENDPOINT: "http://127.0.0.1:9000/private?list=true",
      }),
    /MINIO_ENDPOINT must not include credentials, a path, query, or fragment/,
  );
});

test("rejects bucket names from the other local environment", () => {
  assert.throws(
    () =>
      readLocalServicesConfig({
        LUVIN_ENV: "test",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test",
        REDIS_URL: "redis://127.0.0.1:6380",
        MINIO_ENDPOINT: "127.0.0.1:9100",
        MINIO_ACCESS_KEY: "luvin",
        MINIO_SECRET_KEY: "luvinminio",
        MINIO_AVATAR_BUCKET: "luvin-local-avatars",
        MINIO_EXPORT_BUCKET: "luvin-local-exports",
      }),
    /MinIO bucket names must match the isolated test environment/,
  );
});

test("rejects service URLs from the other local environment", () => {
  assert.throws(
    () =>
      readLocalServicesConfig({
        LUVIN_ENV: "local",
        DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test",
        REDIS_URL: "redis://127.0.0.1:6380",
        MINIO_ENDPOINT: "127.0.0.1:9100",
        MINIO_ACCESS_KEY: "luvin",
        MINIO_SECRET_KEY: "luvinminio",
      }),
    /Local service URLs must match the isolated local environment/,
  );
});
