import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { APP_CONFIG } from "../config/app-config.token";
import { readAppConfig } from "../config/app-config";
import { ApiExceptionFilter } from "./api-exception.filter";
import { requestIdMiddleware } from "./request-id";
import { StructuredLogger } from "./structured-logger";

@Controller("boom")
class BoomController {
  @Get()
  explode(): never {
    throw new Error("password=SuperSecret1! token=abc email=user@example.com");
  }
}

const LOCAL_ENV: NodeJS.ProcessEnv = {
  LUVIN_ENV: "local",
  DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
  REDIS_URL: "redis://127.0.0.1:6379",
  MINIO_ENDPOINT: "127.0.0.1:9000",
  MINIO_ACCESS_KEY: "luvin",
  MINIO_SECRET_KEY: "luvinminio",
};

test("unhandled errors use the API envelope and do not echo private text", async () => {
  const writes: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  let app: INestApplication | undefined;
  try {
    const config = readAppConfig(LOCAL_ENV);
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        StructuredLogger,
        {
          provide: APP_FILTER,
          inject: [StructuredLogger],
          useFactory: (logger: StructuredLogger) =>
            new ApiExceptionFilter(logger),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    await app.init();
    const server = app.getHttpServer() as import("node:http").Server;
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/boom`);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    assert.equal(response.status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.equal(body.error.message, "An unexpected error occurred");
    assert.ok(body.error.requestId);
    assert.equal(body.error.message.includes("SuperSecret1"), false);
    const logs = writes.join("");
    assert.equal(logs.includes("SuperSecret1"), false);
    assert.equal(logs.includes("user@example.com"), false);
  } finally {
    process.stderr.write = original;
    await app?.close();
  }
});
