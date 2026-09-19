import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigValidationError, readAppConfig } from "./config/app-config";
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
  await app.listen(config.port);
}

void bootstrap();
