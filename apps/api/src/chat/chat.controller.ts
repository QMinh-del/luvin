import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString, IsUUID, MaxLength } from "class-validator";
import type { Request } from "express";
import { AccessAuthGuard } from "../auth/access.guard";
import { ChatService } from "./chat.service";

class SendMessageDto {
  @IsUUID()
  clientMessageId!: string;

  @IsString()
  @MaxLength(8000)
  body!: string;
}

@Controller()
@UseGuards(AccessAuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get("connections/:connectionId/conversation")
  async conversation(
    @Param("connectionId") connectionId: string,
    @Req() request: Request,
  ) {
    const data = await this.chat.conversation(
      this.actor(request),
      connectionId,
    );
    return { data, meta: this.meta(request) };
  }

  @Get("conversations/:conversationId/messages")
  async messages(
    @Param("conversationId") conversationId: string,
    @Query("after") after: string | undefined,
    @Req() request: Request,
  ) {
    const messages = await this.chat.messages(
      this.actor(request),
      conversationId,
      after,
    );
    return { data: { messages }, meta: this.meta(request) };
  }

  @Post("conversations/:conversationId/messages")
  @HttpCode(200)
  async send(
    @Param("conversationId") conversationId: string,
    @Body() body: SendMessageDto,
    @Req() request: Request,
  ) {
    const message = await this.chat.send(
      this.actor(request),
      conversationId,
      body.clientMessageId,
      body.body,
      request.requestId ?? "missing-request-id",
    );
    return { data: message, meta: this.meta(request) };
  }

  private actor(request: Request): string {
    return request.auth?.userId ?? "";
  }

  private meta(request: Request): { requestId: string } {
    return { requestId: request.requestId ?? "missing-request-id" };
  }
}
