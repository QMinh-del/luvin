import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsInt, IsISO8601, IsNumber, Max, Min } from "class-validator";
import type { Request } from "express";
import { AccessAuthGuard } from "../auth/access.guard";
import { LocationService } from "./location.service";

class PatchLocationSettingsDto {
  @IsIn(["LIVE", "GHOST", "PAUSED"])
  mode!: "LIVE" | "GHOST" | "PAUSED";
}

class PublishLocationDto {
  @IsISO8601()
  capturedAt!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @Min(0)
  @Max(5000)
  accuracyMeters!: number;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsIn(["FOREGROUND", "BACKGROUND"])
  source!: "FOREGROUND" | "BACKGROUND";
}

@Controller()
@UseGuards(AccessAuthGuard)
export class LocationController {
  constructor(
    @Inject(LocationService) private readonly locations: LocationService,
  ) {}

  @Get("me/location-settings")
  async readSettings(@Req() request: Request) {
    const data = await this.locations.readSettings(this.actor(request));
    return { data, meta: this.meta(request) };
  }

  @Patch("me/location-settings")
  async updateSettings(
    @Body() body: PatchLocationSettingsDto,
    @Req() request: Request,
  ) {
    const data = await this.locations.updateMode(
      this.actor(request),
      body.mode,
    );
    return { data, meta: this.meta(request) };
  }

  @Put("connections/:connectionId/location-viewers/:viewerUserId")
  async grant(
    @Param("connectionId") connectionId: string,
    @Param("viewerUserId") viewerUserId: string,
    @Req() request: Request,
  ) {
    const data = await this.locations.grant(
      this.actor(request),
      connectionId,
      viewerUserId,
      this.requestId(request),
    );
    return { data, meta: this.meta(request) };
  }

  @Delete("connections/:connectionId/location-viewers/:viewerUserId")
  @HttpCode(204)
  async revoke(
    @Param("connectionId") connectionId: string,
    @Param("viewerUserId") viewerUserId: string,
    @Req() request: Request,
  ) {
    await this.locations.revoke(
      this.actor(request),
      connectionId,
      viewerUserId,
      this.requestId(request),
    );
  }

  @Post("connections/:connectionId/locations")
  @HttpCode(200)
  async publish(
    @Param("connectionId") connectionId: string,
    @Body() body: PublishLocationDto,
    @Req() request: Request,
  ) {
    const deviceId = request.auth?.deviceId;
    if (!deviceId) {
      throw new HttpException(
        { code: "AUTH_INVALID_CREDENTIALS", fields: {} },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const data = await this.locations.publish(
      this.actor(request),
      deviceId,
      connectionId,
      body,
    );
    return { data, meta: this.meta(request) };
  }

  @Get("connections/:connectionId/locations/latest")
  async latest(
    @Param("connectionId") connectionId: string,
    @Req() request: Request,
  ) {
    const data = await this.locations.latest(this.actor(request), connectionId);
    return { data, meta: this.meta(request) };
  }

  private actor(request: Request): string {
    return request.auth?.userId ?? "";
  }

  private requestId(request: Request): string {
    return request.requestId ?? "missing-request-id";
  }

  private meta(request: Request): { requestId: string } {
    return { requestId: this.requestId(request) };
  }
}
