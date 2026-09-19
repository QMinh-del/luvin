import { Inject, Injectable } from "@nestjs/common";
import { StructuredLogger } from "../observability/structured-logger";

export type TransactionalMailKind = "password_reset" | "email_change";

@Injectable()
export class MailObservability {
  constructor(
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  observeFailure(requestId: string, kind: TransactionalMailKind): void {
    this.logger.writeEvent("ERROR", "mail.failed", {
      requestId,
      kind,
    });
  }
}
