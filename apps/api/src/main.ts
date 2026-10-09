import type { Server } from "node:http";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigValidationError, readAppConfig } from "./config/app-config";
import { PrismaService } from "./prisma/prisma.service";
import { attachRealtime } from "./realtime/attach-realtime";
import { RealtimeHub } from "./realtime/realtime.hub";
import { TokenService } from "./auth/token.service";
import { StructuredLogger } from "./observability/structured-logger";

async function bootstrap(): Promise<void> {
  let config;
  try {
    config = readAppConfig(process.env);
  } catch (error) {
    const message =
      error instanceof ConfigValidationError
        ? error.message
        : "Invalid configuration";
    process.stderr.write(
      `${JSON.stringify({
        severity: "ERROR",
        event: "config.invalid",
        service: "luvin-api",
        message,
      })}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.create(AppModule.forRoot(process.env), {
    bufferLogs: true,
  });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  logger.startupSummary();
  app.enableShutdownHooks();
  attachRealtime(
    app.getHttpServer() as Server,
    app.get(TokenService),
    app.get(PrismaService),
    app.get(RealtimeHub),
  );
  await app.listen(config.port, "0.0.0.0");
}

void bootstrap();
