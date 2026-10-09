import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { readCaPem } from "../config/host-runtime";
import { MemoryCounterStore, type CounterStore } from "../auth/counter-store";
import { RedisCounterStore } from "./redis-counter-store";

export type { CounterStore };

export const COUNTER_STORE = "COUNTER_STORE";

@Injectable()
export class RedisRuntime implements OnModuleDestroy {
  private client: Redis | undefined;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  getClient(): Redis {
    if (!this.client) {
      const ca = readCaPem(this.config.redisSslCa);
      this.client = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
        ...(ca ? { tls: { ca } } : {}),
      });
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
    }
  }
}

export function createCounterStore(
  config: AppConfig,
  redis: RedisRuntime,
): CounterStore {
  if (config.luvinEnv === "test") {
    return new MemoryCounterStore();
  }
  return new RedisCounterStore(redis.getClient());
}
