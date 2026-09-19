import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { StructuredLogger } from "./structured-logger";

export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function resolveRequestId(raw: string | undefined): string {
  if (raw && REQUEST_ID_PATTERN.test(raw)) {
    return raw;
  }
  return randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header(REQUEST_ID_HEADER);
  const requestId = resolveRequestId(header);
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

@Injectable()
export class RequestTracingMiddleware implements NestMiddleware {
  constructor(
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    requestIdMiddleware(req, res, () => {
      res.on("finish", () => {
        this.logger.writeEvent("INFO", "http.request", {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
        });
      });
      next();
    });
  }
}
