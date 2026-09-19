import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AuthService } from "./auth.service";
import { AccessAuthGuard } from "./access.guard";

class DeviceDto {
  @IsString()
  publicId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

class RegisterDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  dateOfBirth!: string;

  @IsString()
  username!: string;

  @IsString()
  displayName!: string;

  @IsString()
  termsVersion!: string;

  @IsString()
  privacyVersion!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;

  @ValidateNested()
  @Type(() => DeviceDto)
  device!: DeviceDto;
}

class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;

  @ValidateNested()
  @Type(() => DeviceDto)
  device!: DeviceDto;
}

class RefreshDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;

  @IsString()
  devicePublicId!: string;
}

class PasswordResetRequestDto {
  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

class PasswordResetConfirmDto {
  @IsString()
  token!: string;

  @IsString()
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  @HttpCode(201)
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    const result = await this.auth.register(
      body,
      request.requestId ?? "missing-request-id",
      clientIp(request),
    );
    return envelope(result, request);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Req() request: Request) {
    const result = await this.auth.login(
      body.email,
      body.password,
      body.device,
      request.requestId ?? "missing-request-id",
      clientIp(request),
      body.turnstileToken,
    );
    return envelope(result, request);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() body: RefreshDto, @Req() request: Request) {
    const result = await this.auth.refresh(
      body.refreshToken,
      body.devicePublicId,
      request.requestId ?? "missing-request-id",
      clientIp(request),
    );
    return envelope(result, request);
  }

  @Post("logout")
  @UseGuards(AccessAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: Request): Promise<void> {
    await this.auth.logoutCurrent(
      request.auth?.sessionId ?? "",
      request.requestId ?? "missing-request-id",
    );
  }

  @Get("sessions")
  @UseGuards(AccessAuthGuard)
  async sessions(@Req() request: Request) {
    const data = await this.auth.listSessions(request.auth?.userId ?? "");
    return {
      data,
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
  }

  @Delete("sessions/:sessionId")
  @UseGuards(AccessAuthGuard)
  @HttpCode(204)
  async revoke(
    @Param("sessionId") sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.revokeSession(
      request.auth?.userId ?? "",
      sessionId,
      request.requestId ?? "missing-request-id",
    );
  }

  @Post("password-reset/request")
  @HttpCode(202)
  async requestReset(
    @Body() body: PasswordResetRequestDto,
    @Req() request: Request,
  ) {
    await this.auth.requestPasswordReset(
      body.email,
      request.requestId ?? "missing-request-id",
      clientIp(request),
      body.turnstileToken,
    );
    return {
      data: {},
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
  }

  @Post("password-reset/confirm")
  @HttpCode(204)
  async confirmReset(
    @Body() body: PasswordResetConfirmDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.confirmPasswordReset(
      body.token,
      body.password,
      request.requestId ?? "missing-request-id",
    );
  }
}

function clientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || "0.0.0.0";
}

function envelope(
  result: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    sessionId: string;
    accountState: string;
    requiredLegalActions: string[];
  },
  request: Request,
) {
  return {
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
      sessionId: result.sessionId,
      accountState: result.accountState,
      requiredLegalActions: result.requiredLegalActions,
    },
    meta: { requestId: request.requestId ?? "missing-request-id" },
  };
}
