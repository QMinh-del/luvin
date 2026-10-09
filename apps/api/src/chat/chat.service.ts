import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AuditActorType, MessageState } from "@prisma/client";
import { loadActivePartnership } from "../couple/active-partnership";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeHub } from "../realtime/realtime.hub";
import { normalizeMessageBody } from "./chat-policy";

export type ChatMessageView = {
  messageId: string;
  senderUserId: string | null;
  clientMessageId: string;
  body: string;
  serverSequence: string;
  createdAt: string;
};

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeHub) private readonly realtime: RealtimeHub,
  ) {}

  async conversation(
    actorUserId: string,
    connectionId: string,
  ): Promise<{ conversationId: string; connectionId: string }> {
    const partnership = await loadActivePartnership(
      this.prisma.client,
      actorUserId,
      connectionId,
    );
    if (!partnership) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { connectionId },
      select: { id: true },
    });
    if (!conversation) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return { conversationId: conversation.id, connectionId };
  }

  async messages(
    actorUserId: string,
    conversationId: string,
    after: string | undefined,
  ): Promise<ChatMessageView[]> {
    await this.requireMember(actorUserId, conversationId);
    const afterSequence = parseCursor(after);
    const rows = await this.prisma.client.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(afterSequence === null
          ? {}
          : { serverSequence: { gt: afterSequence } }),
      },
      orderBy: { serverSequence: "asc" },
      take: 50,
      select: {
        id: true,
        senderUserId: true,
        clientMessageId: true,
        bodyText: true,
        serverSequence: true,
        createdAt: true,
      },
    });
    return rows.map(toView);
  }

  async send(
    actorUserId: string,
    conversationId: string,
    clientMessageId: string,
    body: string,
    correlationId: string,
  ): Promise<ChatMessageView> {
    const normalized = normalizeMessageBody(body);
    if (!normalized) {
      throw apiError(HttpStatus.BAD_REQUEST, "MESSAGE_INVALID");
    }
    const access = await this.requireMember(actorUserId, conversationId);
    if (access.blocked) {
      throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
    }
    const existing = await this.prisma.client.message.findFirst({
      where: { conversationId, clientMessageId },
      select: {
        id: true,
        senderUserId: true,
        clientMessageId: true,
        bodyText: true,
        serverSequence: true,
        createdAt: true,
      },
    });
    if (existing) {
      const view = toView(existing);
      this.publishMessage(actorUserId, access, conversationId, view);
      return view;
    }
    const created = await this.prisma.client.$transaction(async (tx) => {
      const replay = await tx.message.findFirst({
        where: { conversationId, clientMessageId },
      });
      if (replay) {
        return replay;
      }
      const last = await tx.message.findFirst({
        where: { conversationId },
        orderBy: { serverSequence: "desc" },
        select: { serverSequence: true },
      });
      const message = await tx.message.create({
        data: {
          id: randomUUID(),
          conversationId,
          senderUserId: actorUserId,
          clientMessageId,
          bodyText: normalized,
          state: MessageState.ACCEPTED,
          serverSequence: (last?.serverSequence ?? 0n) + 1n,
          createdAt: new Date(),
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          actorType: AuditActorType.USER,
          actorUserId,
          action: "chat.message",
          resourceType: "conversation",
          resourceId: conversationId,
          connectionId: access.connectionId,
          result: "ALLOWED",
          metadata: {},
          correlationId,
          createdAt: new Date(),
        },
      });
      return message;
    });
    const view = toView(created);
    this.publishMessage(actorUserId, access, conversationId, view);
    return view;
  }

  private publishMessage(
    actorUserId: string,
    access: { partnerUserId: string; connectionId: string },
    conversationId: string,
    view: ChatMessageView,
  ): void {
    this.realtime.publishToUsers([actorUserId, access.partnerUserId], {
      event: "chat.message.created.v1",
      connectionId: access.connectionId,
      payload: {
        messageId: view.messageId,
        conversationId,
        clientMessageId: view.clientMessageId,
        sender: { userId: view.senderUserId, displayLabel: "" },
        body: view.body,
        serverSequence: view.serverSequence,
        createdAt: view.createdAt,
      },
    });
  }

  private async requireMember(actorUserId: string, conversationId: string) {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, connectionId: true },
    });
    if (!conversation) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    const partnership = await loadActivePartnership(
      this.prisma.client,
      actorUserId,
      conversation.connectionId,
    );
    if (!partnership) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return { ...partnership, connectionId: conversation.connectionId };
  }
}

function toView(row: {
  id: string;
  senderUserId: string | null;
  clientMessageId: string;
  bodyText: string;
  serverSequence: bigint;
  createdAt: Date;
}): ChatMessageView {
  return {
    messageId: row.id,
    senderUserId: row.senderUserId,
    clientMessageId: row.clientMessageId,
    body: row.bodyText,
    serverSequence: row.serverSequence.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function parseCursor(after: string | undefined): bigint | null {
  if (!after) {
    return null;
  }
  if (!/^\d+$/.test(after)) {
    throw apiError(HttpStatus.BAD_REQUEST, "MESSAGE_CURSOR_INVALID");
  }
  return BigInt(after);
}

function apiError(status: HttpStatus, code: string): HttpException {
  return new HttpException({ code, fields: {} }, status);
}
