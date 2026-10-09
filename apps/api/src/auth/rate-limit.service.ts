import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { COUNTER_STORE, type CounterStore } from "../infra/redis.runtime";

export type AuthRateBucket =
  | "register"
  | "login"
  | "refresh"
  | "password_reset"
  | "email_change";

@Injectable()
export class RateLimitService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
  ) {}

  async consume(bucket: AuthRateBucket, subject: string): Promise<void> {
    const policy = this.config.authRateLimits[bucket];
    const key = `rl:${bucket}:${subject}`;
    const count = await this.counters.incr(
      key,
      this.config.authRateLimits.windowSec,
    );
    if (count > policy.max) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          fields: {
            retryAfterSeconds: String(this.config.authRateLimits.windowSec),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
