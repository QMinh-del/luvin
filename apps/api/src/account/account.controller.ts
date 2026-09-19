import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { IsString } from "class-validator";
import { AccessAuthGuard } from "../auth/access.guard";
import { AuthService } from "../auth/auth.service";

class DateOfBirthDto {
  @IsString()
  dateOfBirth!: string;

  @IsString()
  password!: string;
}

class EmailChangeRequestDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

class EmailChangeConfirmDto {
  @IsString()
  token!: string;
}

class LegalConsentDto {
  @IsString()
  termsVersion!: string;

  @IsString()
  privacyVersion!: string;
}

@Controller("account")
export class AccountController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Patch("date-of-birth")
  @UseGuards(AccessAuthGuard)
  @HttpCode(200)
  async correctDateOfBirth(
    @Body() body: DateOfBirthDto,
    @Req() request: Request,
  ) {
    const result = await this.auth.correctDateOfBirth(
      request.auth?.userId ?? "",
      body.password,
      body.dateOfBirth,
      request.requestId ?? "missing-request-id",
    );
    return {
      data: {
        accountState: result.accountState,
        code: result.code ?? null,
      },
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
  }

  @Post("email-change/request")
  @UseGuards(AccessAuthGuard)
  @HttpCode(202)
  async requestEmailChange(
    @Body() body: EmailChangeRequestDto,
    @Req() request: Request,
  ) {
    await this.auth.requestEmailChange(
      request.auth?.userId ?? "",
      body.password,
      body.email,
      request.requestId ?? "missing-request-id",
    );
    return {
      data: {},
      meta: { requestId: request.requestId ?? "missing-request-id" },
    };
  }

  @Post("email-change/confirm")
  @UseGuards(AccessAuthGuard)
  @HttpCode(204)
  async confirmEmailChange(
    @Body() body: EmailChangeConfirmDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.confirmEmailChange(
      request.auth?.userId ?? "",
      body.token,
      request.requestId ?? "missing-request-id",
    );
  }

  @Post("legal-consent")
  @UseGuards(AccessAuthGuard)
  @HttpCode(204)
  async legalConsent(
    @Body() body: LegalConsentDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.acceptLegalConsent(
      request.auth?.userId ?? "",
      body.termsVersion,
      body.privacyVersion,
      request.requestId ?? "missing-request-id",
    );
  }
}
