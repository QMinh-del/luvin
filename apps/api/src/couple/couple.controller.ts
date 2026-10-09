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
import { IsString, IsUUID } from "class-validator";
import type { Request } from "express";
import { AccessAuthGuard } from "../auth/access.guard";
import { CoupleService } from "./couple.service";
import { RealtimeHub } from "../realtime/realtime.hub";

class CoupleRequestDto {
  @IsString()
  username!: string;
}

class RedeemPairingCodeDto {
  @IsString()
  code!: string;
}

class BlockDto {
  @IsUUID()
  targetUserId!: string;
}

@Controller()
@UseGuards(AccessAuthGuard)
export class CoupleController {
  constructor(
    @Inject(CoupleService) private readonly couples: CoupleService,
    @Inject(RealtimeHub) private readonly realtime: RealtimeHub,
  ) {}

  @Get("connections")
  async list(@Req() request: Request) {
    const connections = await this.couples.list(this.actor(request));
    return { data: { connections }, meta: this.meta(request) };
  }

  @Get("connections/:connectionId")
  async read(
    @Param("connectionId") connectionId: string,
    @Req() request: Request,
  ) {
    const couple = await this.couples.read(this.actor(request), connectionId);
    return { data: couple, meta: this.meta(request) };
  }

  @Post("me/pairing-codes")
  @HttpCode(200)
  async createPairingCode(@Req() request: Request) {
    const code = await this.couples.createPairingCode(
      this.actor(request),
      this.key(request),
      this.requestId(request),
    );
    return { data: code, meta: this.meta(request) };
  }

  @Get("me/pairing-codes/current")
  async currentPairingCode(@Req() request: Request) {
    const code = await this.couples.currentPairingCode(this.actor(request));
    return { data: code, meta: this.meta(request) };
  }

  @Post("pairing-codes/redeem")
  @HttpCode(200)
  async redeemPairingCode(
    @Body() body: RedeemPairingCodeDto,
    @Req() request: Request,
  ) {
    const couple = await this.couples.redeemPairingCode(
      this.actor(request),
      body.code,
      this.key(request),
      this.requestId(request),
    );
    this.notify(couple);
    return { data: couple, meta: this.meta(request) };
  }

  @Post("connections/couple-requests")
  @HttpCode(200)
  async requestCouple(@Body() body: CoupleRequestDto, @Req() request: Request) {
    const couple = await this.couples.requestCouple(
      this.actor(request),
      body.username,
      this.key(request),
      this.requestId(request),
    );
    this.notify(couple);
    return { data: couple, meta: this.meta(request) };
  }

  @Post("connection-invitations/:invitationId/accept")
  @HttpCode(200)
  async accept(
    @Param("invitationId") invitationId: string,
    @Req() request: Request,
  ) {
    const couple = await this.couples.accept(
      this.actor(request),
      invitationId,
      this.key(request),
      this.requestId(request),
    );
    this.notify(couple);
    return { data: couple, meta: this.meta(request) };
  }

  @Post("connection-invitations/:invitationId/reject")
  @HttpCode(200)
  async reject(
    @Param("invitationId") invitationId: string,
    @Req() request: Request,
  ) {
    const couple = await this.couples.reject(
      this.actor(request),
      invitationId,
      this.key(request),
      this.requestId(request),
    );
    this.notify(couple);
    return { data: couple, meta: this.meta(request) };
  }

  @Delete("connections/:connectionId")
  async disconnect(
    @Param("connectionId") connectionId: string,
    @Req() request: Request,
  ) {
    const couple = await this.couples.disconnect(
      this.actor(request),
      connectionId,
      this.key(request),
      this.requestId(request),
    );
    this.notify(couple);
    return { data: couple, meta: this.meta(request) };
  }

  @Post("blocks")
  @HttpCode(200)
  async block(@Body() body: BlockDto, @Req() request: Request) {
    const block = await this.couples.block(
      this.actor(request),
      body.targetUserId,
      this.key(request),
      this.requestId(request),
    );
    return { data: block, meta: this.meta(request) };
  }

  @Delete("blocks/:userId")
  @HttpCode(204)
  async unblock(@Param("userId") userId: string, @Req() request: Request) {
    await this.couples.unblock(
      this.actor(request),
      userId,
      this.key(request),
      this.requestId(request),
    );
  }

  private notify(couple: {
    connectionId: string;
    state: string;
    partners: Array<{
      userId: string;
      username: string;
      displayName: string;
      membershipState: string;
    }>;
  }): void {
    this.realtime.publishToUsers(
      couple.partners.map((partner) => partner.userId),
      {
        event:
          couple.state === "PENDING"
            ? "connection.invitation.created.v1"
            : "couple.partnership.changed.v1",
        connectionId: couple.connectionId,
        payload: {
          state: couple.state,
          partners: couple.partners.map((partner) => ({
            userId: partner.userId,
            username: partner.username,
            displayName: partner.displayName,
            membershipState: partner.membershipState,
          })),
        },
      },
    );
  }

  private actor(request: Request): string {
    return request.auth?.userId ?? "";
  }

  private key(request: Request): string {
    return request.header("idempotency-key") ?? "";
  }

  private requestId(request: Request): string {
    return request.requestId ?? "missing-request-id";
  }

  private meta(request: Request): { requestId: string } {
    return { requestId: this.requestId(request) };
  }
}
