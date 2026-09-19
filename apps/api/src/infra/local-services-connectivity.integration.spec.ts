import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import {
  LOCAL_SERVICES_CONFIG,
  LocalServicesConnector,
} from "./local-services-connector";
import { readLocalServicesConfig } from "./local-services-config";

const LOCAL_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

const TEST_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "test",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test",
  REDIS_URL: "redis://127.0.0.1:6380",
  MINIO_ENDPOINT: "127.0.0.1:9100",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

async function verifyWithEnv(env: NodeJS.ProcessEnv): Promise<void> {
  const config = readLocalServicesConfig(env);
  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: LOCAL_SERVICES_CONFIG, useValue: config },
      LocalServicesConnector,
    ],
  }).compile();
  const connector = moduleRef.get(LocalServicesConnector);
  const status = await connector.verify();
  assert.equal(status.postgres, true);
  assert.equal(status.redis, true);
  assert.equal(status.minio, true);
  await moduleRef.close();
}

test("API connects to isolated local PostgreSQL, Redis, and private MinIO buckets", async (t) => {
  if (process.env.RUN_INFRA_TESTS !== "1") {
    t.skip("Set RUN_INFRA_TESTS=1 after docker compose is healthy");
    return;
  }
  await verifyWithEnv(LOCAL_ENV);
});

test("API connects to isolated test PostgreSQL, Redis, and private MinIO buckets", async (t) => {
  if (process.env.RUN_INFRA_TESTS !== "1") {
    t.skip("Set RUN_INFRA_TESTS=1 after docker compose is healthy");
    return;
  }
  await verifyWithEnv(TEST_ENV);
});
