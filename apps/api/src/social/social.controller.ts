import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import type { Request } from "express";
import { AccessAuthGuard } from "../auth/access.guard";
import { SocialService } from "./social.service";

class ProfileDto {
  @IsString()
  @MaxLength(80)
  displayName!: string;
}

class MoodDto {
  @IsString()
  moodCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

class LovePingDto {
  @IsUUID()
  targetUserId!: string;

  @IsUUID()
  clientRequestId!: string;
}

@Controller()
@UseGuards(AccessAuthGuard)
export class SocialController {
  constructor(@Inject(SocialService) private readonly social: SocialService) {}

  @Get("me/profile")
  async profile(@Req() request: Request) {
    const data = await this.social.profile(this.actor(request));
    return { data, meta: this.meta(request) };
  }

  @Patch("me/profile")
  async updateProfile(@Body() body: ProfileDto, @Req() request: Request) {
    const data = await this.social.updateProfile(
      this.actor(request),
      body.displayName,
    );
    return { data, meta: this.meta(request) };
  }

  @Put("me/mood")
  async setMood(@Body() body: MoodDto, @Req() request: Request) {
    const data = await this.social.setMood(
      this.actor(request),
      body.moodCode,
      body.note,
    );
    return { data, meta: this.meta(request) };
  }

  @Delete("me/mood")
  @HttpCode(204)
  async clearMood(@Req() request: Request) {
    await this.social.clearMood(this.actor(request));
  }

  @Get("connections/:connectionId/moods")
  async moods(
    @Param("connectionId") connectionId: string,
    @Req() request: Request,
  ) {
    const data = await this.social.moods(this.actor(request), connectionId);
    return { data, meta: this.meta(request) };
  }

  @Post("connections/:connectionId/love-pings")
  @HttpCode(200)
  async lovePing(
    @Param("connectionId") connectionId: string,
    @Body() body: LovePingDto,
    @Req() request: Request,
  ) {
    const data = await this.social.lovePing(
      this.actor(request),
      connectionId,
      body.targetUserId,
      body.clientRequestId,
    );
    return { data, meta: this.meta(request) };
  }

  private actor(request: Request): string {
    return request.auth?.userId ?? "";
  }

  private meta(request: Request): { requestId: string } {
    return { requestId: request.requestId ?? "missing-request-id" };
  }
}
