import {
  MiddlewareConsumer,
  Module,
  type DynamicModule,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { readAppConfig } from "./config/app-config";
import { APP_CONFIG } from "./config/app-config.token";
import { AccountController } from "./account/account.controller";
import { AccessAuthGuard } from "./auth/access.guard";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { RateLimitService } from "./auth/rate-limit.service";
import { TokenService } from "./auth/token.service";
import { TurnstileService } from "./auth/turnstile.service";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { PrismaService } from "./prisma/prisma.service";
import {
  LOCAL_SERVICES_CONFIG,
  LocalServicesConnector,
} from "./infra/local-services-connector";
import {
  COUNTER_STORE,
  RedisRuntime,
  createCounterStore,
} from "./infra/redis.runtime";
import { MailObservability } from "./mail/mail-observability";
import { MAIL_SINK, MailSender, createMailSink } from "./mail/mail-sender";
import { ApiExceptionFilter } from "./observability/api-exception.filter";
import { RequestTracingMiddleware } from "./observability/request-id";
import { StructuredLogger } from "./observability/structured-logger";

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const config = readAppConfig(env);
    const localProviders = config.localServices
      ? [
          {
            provide: LOCAL_SERVICES_CONFIG,
            useValue: config.localServices,
          },
          LocalServicesConnector,
        ]
      : [];

    return {
      module: AppModule,
      controllers: [HealthController, AuthController, AccountController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        StructuredLogger,
        RequestTracingMiddleware,
        HealthService,
        MailObservability,
        PrismaService,
        RedisRuntime,
        {
          provide: COUNTER_STORE,
          inject: [APP_CONFIG, RedisRuntime],
          useFactory: createCounterStore,
        },
        {
          provide: MAIL_SINK,
          useValue: config.luvinEnv === "test" ? createMailSink() : null,
        },
        TokenService,
        RateLimitService,
        TurnstileService,
        MailSender,
        AuthService,
        AccessAuthGuard,
        {
          provide: APP_FILTER,
          inject: [StructuredLogger],
          useFactory: (logger: StructuredLogger) =>
            new ApiExceptionFilter(logger),
        },
        ...localProviders,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestTracingMiddleware).forRoutes("*");
  }
}
