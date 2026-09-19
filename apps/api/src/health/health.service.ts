import { Inject, Injectable, Optional } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import type { HealthCheckState, HealthReadyData } from "@luvin/shared-types";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { LocalServicesConnector } from "../infra/local-services-connector";

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Optional()
    @Inject(LocalServicesConnector)
    private readonly localServices?: LocalServicesConnector,
  ) {}

  live(): { status: "live" } {
    return { status: "live" };
  }

  async ready(): Promise<HealthReadyData> {
    const postgres = await this.pingPostgres();
    const redis = await this.pingRedis();
    const objectStorage = await this.pingObjectStorage();
    const requiredUp =
      postgres === "up" && redis === "up" && objectStorage !== "down";
    return {
      status: requiredUp ? "ready" : "not_ready",
      checks: {
        postgres,
        redis,
        objectStorage,
      },
    };
  }

  private async pingObjectStorage(): Promise<HealthCheckState> {
    if (!this.config.localServices || !this.localServices) {
      return "skipped";
    }
    try {
      await this.localServices.verifyObjectStorage();
      return "up";
    } catch {
      return "down";
    }
  }

  private async pingPostgres(): Promise<HealthCheckState> {
    const prisma = new PrismaClient({
      datasources: { db: { url: this.config.databaseUrl } },
    });
    try {
      await prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    } finally {
      await prisma.$disconnect();
    }
  }

  private async pingRedis(): Promise<HealthCheckState> {
    const redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 250,
      retryStrategy: () => null,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return pong === "PONG" ? "up" : "down";
    } catch {
      return "down";
    } finally {
      redis.disconnect();
    }
  }
}
