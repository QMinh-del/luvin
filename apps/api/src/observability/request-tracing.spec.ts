import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { INestApplication, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import { readAppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { RequestTracingMiddleware } from "./request-id";
import { StructuredLogger } from "./structured-logger";

const LOCAL_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
  ACCESS_TOKEN_SECRET: "local-test-access-token-secret-32b",
};

@Module({
  providers: [
    { provide: APP_CONFIG, useValue: readAppConfig(LOCAL_ENV) },
    StructuredLogger,
    RequestTracingMiddleware,
  ],
})
class TracingTestModule {}

test("access logs include requestId and omit query credentials", async () => {
  const writes: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  let app: INestApplication | undefined;
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [TracingTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    const middleware = app.get(RequestTracingMiddleware);
    app.use((req: Request, res: Response, next: NextFunction) => {
      middleware.use(req, res, next);
    });
    app.use((_req: Request, res: Response) => {
      res.status(204).end();
    });
    await app.init();
    const server = app.getHttpServer() as import("node:http").Server;
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await fetch(
      `http://127.0.0.1:${address.port}/v1/health/live?token=secret-token`,
      { headers: { "X-Request-ID": "trace-1" } },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const payload = writes.join("");
    assert.match(payload, /http.request/);
    assert.match(payload, /trace-1/);
    assert.equal(payload.includes("secret-token"), false);
    assert.equal(payload.includes("token="), false);
  } finally {
    process.stdout.write = original;
    await app?.close();
  }
});
