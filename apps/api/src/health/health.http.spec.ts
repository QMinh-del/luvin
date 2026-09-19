import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { INestApplication, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { APP_CONFIG } from "../config/app-config.token";
import { readAppConfig } from "../config/app-config";
import { ApiExceptionFilter } from "../observability/api-exception.filter";
import { requestIdMiddleware } from "../observability/request-id";
import { StructuredLogger } from "../observability/structured-logger";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

const LOCAL_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_CONFIG,
      useValue: readAppConfig(LOCAL_ENV),
    },
    StructuredLogger,
    {
      provide: HealthService,
      useValue: {
        live: () => ({ status: "live" }),
        ready: async () => ({
          status: "not_ready",
          checks: { postgres: "up", redis: "down", objectStorage: "skipped" },
        }),
      },
    },
    {
      provide: APP_FILTER,
      inject: [StructuredLogger],
      useFactory: (logger: StructuredLogger) => new ApiExceptionFilter(logger),
    },
  ],
})
class HealthHttpTestModule {}

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthHttpTestModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  app.use(requestIdMiddleware);
  await app.init();
  return app;
}

async function listen(app: INestApplication): Promise<number> {
  const server = app.getHttpServer() as import("node:http").Server;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

test("liveness does not depend on downstream services", async () => {
  const app = await createApp();
  const port = await listen(app);
  const response = await fetch(`http://127.0.0.1:${port}/v1/health/live`, {
    headers: { "X-Request-ID": "live-check-1" },
  });
  const body = (await response.json()) as {
    data: { status: string };
    meta: { requestId: string };
  };
  assert.equal(response.status, 200);
  assert.equal(body.data.status, "live");
  assert.equal(body.meta.requestId, "live-check-1");
  await app.close();
});

test("readiness returns 503 when dependencies are down", async () => {
  const app = await createApp();
  const port = await listen(app);
  const response = await fetch(`http://127.0.0.1:${port}/v1/health/ready`);
  const body = (await response.json()) as {
    data: { status: string; checks: { redis: string } };
    meta: { requestId: string };
  };
  assert.equal(response.status, 503);
  assert.equal(body.data.status, "not_ready");
  assert.equal(body.data.checks.redis, "down");
  assert.ok(body.meta.requestId);
  await app.close();
});
