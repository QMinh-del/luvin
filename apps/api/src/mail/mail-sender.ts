import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import {
  MailObservability,
  type TransactionalMailKind,
} from "./mail-observability";

export const MAIL_SINK = "MAIL_SINK";

export type MailSink = {
  passwordResetTokens: string[];
  emailChangeTokens: string[];
};

export function createMailSink(): MailSink {
  return { passwordResetTokens: [], emailChangeTokens: [] };
}

@Injectable()
export class MailSender {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MailObservability)
    private readonly observability: MailObservability,
    @Optional() @Inject(MAIL_SINK) private readonly sink: MailSink | null,
  ) {}

  async sendPasswordReset(
    requestId: string,
    recipient: string,
    rawToken: string,
  ): Promise<void> {
    this.sink?.passwordResetTokens.push(rawToken);
    await this.dispatch(requestId, "password_reset", recipient, rawToken);
  }

  async sendEmailChange(
    requestId: string,
    recipient: string,
    rawToken: string,
  ): Promise<void> {
    this.sink?.emailChangeTokens.push(rawToken);
    await this.dispatch(requestId, "email_change", recipient, rawToken);
  }

  private async dispatch(
    requestId: string,
    kind: TransactionalMailKind,
    recipient: string,
    rawToken: string,
  ): Promise<void> {
    if (this.config.resend.mode === "disabled") {
      return;
    }
    if (this.config.luvinEnv === "test") {
      return;
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.resend.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.resend.from,
          to: [recipient],
          subject:
            kind === "password_reset"
              ? "Reset your password"
              : "Confirm your email",
          text: `Token: ${rawToken}`,
        }),
      });
      if (!response.ok) {
        this.observability.observeFailure(requestId, kind);
      }
    } catch {
      this.observability.observeFailure(requestId, kind);
    }
  }
}
