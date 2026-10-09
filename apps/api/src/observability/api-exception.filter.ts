import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ApiErrorEnvelope } from "@luvin/shared-types";
import { StructuredLogger } from "./structured-logger";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = request.requestId ?? "missing-request-id";

    const { status, code, message, fields } = this.mapException(exception);

    if (code === "RATE_LIMITED" && fields.retryAfterSeconds) {
      response.setHeader("Retry-After", fields.retryAfterSeconds);
    }

    this.logger.writeEvent(
      status >= 500 ? "ERROR" : "WARNING",
      "http.exception",
      {
        requestId,
        status,
        code,
        path: request.originalUrl,
        errorName: exception instanceof Error ? exception.name : "unknown",
      },
    );

    const body: ApiErrorEnvelope = {
      error: {
        code,
        message,
        fields,
        requestId,
      },
    };
    response.status(status).json(body);
  }

  private mapException(exception: unknown): {
    status: number;
    code: string;
    message: string;
    fields: Record<string, string>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const fields =
        typeof payload === "object" &&
        payload !== null &&
        "fields" in payload &&
        typeof payload.fields === "object" &&
        payload.fields !== null
          ? Object.fromEntries(
              Object.entries(payload.fields as Record<string, unknown>).map(
                ([key, value]) => [key, String(value)],
              ),
            )
          : {};
      const code =
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        typeof payload.code === "string"
          ? payload.code
          : httpStatusToCode(status);
      return {
        status,
        code,
        message: safeHttpMessage(status, code),
        fields,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      fields: {},
    };
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "AUTH_INVALID_CREDENTIALS";
    case HttpStatus.FORBIDDEN:
      return "PERMISSION_DENIED";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "VALIDATION_FAILED";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    case HttpStatus.SERVICE_UNAVAILABLE:
      return "SERVICE_UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
  }
}

function safeHttpMessage(status: number, code?: string): string {
  if (code === "AGE_INELIGIBLE") {
    return "Age eligibility was not met";
  }
  if (code === "ACCOUNT_AGE_INELIGIBLE") {
    return "Account is limited to export and deletion";
  }
  if (code === "LEGAL_CONSENT_REQUIRED") {
    return "Updated legal terms must be accepted";
  }
  switch (status) {
    case HttpStatus.NOT_FOUND:
      return "Resource unavailable";
    case HttpStatus.UNAUTHORIZED:
      return "Authentication required";
    case HttpStatus.FORBIDDEN:
      return "Permission denied";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Too many requests";
    case HttpStatus.SERVICE_UNAVAILABLE:
      return "Service unavailable";
    default:
      return status >= 500
        ? "An unexpected error occurred"
        : "Request could not be processed";
  }
}
