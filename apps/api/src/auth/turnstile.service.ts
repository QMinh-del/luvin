import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { COUNTER_STORE, type CounterStore } from "../infra/redis.runtime";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const USED_TTL_SEC = 300;

export type TurnstileAction = "register" | "login" | "password_reset";

type SiteVerifyResponse = {
  success?: boolean;
  action?: string;
};

@Injectable()
export class TurnstileService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
  ) {}

  async enforce(input: {
    challenged: boolean;
    token: string | undefined;
    action: TurnstileAction;
    ip: string;
  }): Promise<void> {
    if (!input.challenged) {
      return;
    }
    const token = input.token?.trim() ?? "";
    if (!token) {
      throw new HttpException(
        { code: "CAPTCHA_REQUIRED", fields: {} },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const usedKey = `turnstile:used:${hashToken(token)}`;
    const reserved = await this.counters.setNx(usedKey, USED_TTL_SEC);
    if (!reserved) {
      throw new HttpException(
        { code: "CAPTCHA_INVALID", fields: {} },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const valid = await this.verifyProvider(token, input.action, input.ip);
    if (!valid) {
      throw new HttpException(
        { code: "CAPTCHA_INVALID", fields: {} },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async verifyProvider(
    token: string,
    action: TurnstileAction,
    ip: string,
  ): Promise<boolean> {
    if (this.config.turnstile.mode === "local") {
      return token.length >= 16;
    }
    const body = new URLSearchParams({
      secret: this.config.turnstile.secret,
      response: token,
      remoteip: ip,
    });
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      return false;
    }
    const payload = (await response.json()) as SiteVerifyResponse;
    if (payload.success !== true) {
      return false;
    }
    if (payload.action && payload.action !== action) {
      return false;
    }
    return true;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
