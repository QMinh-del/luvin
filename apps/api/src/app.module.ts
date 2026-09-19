import {
  MiddlewareConsumer,
  Module,
  type DynamicModule,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { readAppConfig } from "./config/app-config";
import { APP_CONFIG } from "./config/app-config.token";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import {
  LOCAL_SERVICES_CONFIG,
  LocalServicesConnector,
} from "./infra/local-services-connector";
import { MailObservability } from "./mail/mail-observability";
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
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        StructuredLogger,
        RequestTracingMiddleware,
        HealthService,
        MailObservability,
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
