import { Inject, Injectable, type LoggerService } from "@nestjs/common";
import { publicAppConfig, type AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { redactValue } from "./redact";

type LogSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

@Injectable()
export class StructuredLogger implements LoggerService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("INFO", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("ERROR", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("WARNING", message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.write("DEBUG", message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.write("DEBUG", message, optionalParams);
  }

  writeEvent(
    severity: LogSeverity,
    event: string,
    fields: Record<string, unknown> = {},
  ): void {
    this.emit(severity, {
      event,
      ...fields,
    });
  }

  private write(
    severity: LogSeverity,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context =
      typeof optionalParams[optionalParams.length - 1] === "string"
        ? (optionalParams[optionalParams.length - 1] as string)
        : undefined;
    this.emit(severity, {
      event: "logger.message",
      message,
      context,
    });
  }

  private emit(severity: LogSeverity, fields: Record<string, unknown>): void {
    const payload: Record<string, unknown> = {
      severity,
      service: "luvin-api",
      luvinEnv: this.config.luvinEnv,
      googleCloudProject: this.config.googleCloudProject ?? null,
      ...(redactValue(fields) as Record<string, unknown>),
    };
    if (severity === "ERROR" && this.config.googleCloudProject) {
      payload["@type"] =
        "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";
      payload.serviceContext = {
        service: "luvin-api",
        version: "0.0.0",
      };
    }
    const line = `${JSON.stringify(payload)}\n`;
    if (severity === "ERROR") {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  startupSummary(): void {
    this.writeEvent("INFO", "config.loaded", publicAppConfig(this.config));
  }
}
