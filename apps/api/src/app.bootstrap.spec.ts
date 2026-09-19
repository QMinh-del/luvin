import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { LUVIN_CONTRACT_VERSION } from "@luvin/shared-types";
import { AppModule } from "./app.module";

const LOCAL_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

test("shared types are reachable from the API", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});

test("Nest application boots AppModule with validated local config", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(LOCAL_ENV)],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  assert.ok(app);
  await app.close();
});
