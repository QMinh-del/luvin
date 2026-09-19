import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type {
  ApiSuccessEnvelope,
  HealthLiveData,
  HealthReadyData,
} from "@luvin/shared-types";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get("live")
  live(@Req() request: Request): ApiSuccessEnvelope<HealthLiveData> {
    return {
      data: this.health.live(),
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
  }

  @Get("ready")
  async ready(
    @Req() request: Request,
    @Res({ passthrough: false }) response: Response,
  ): Promise<void> {
    const data = await this.health.ready();
    const body: ApiSuccessEnvelope<HealthReadyData> = {
      data,
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
    response.status(data.status === "ready" ? 200 : 503).json(body);
  }
}
