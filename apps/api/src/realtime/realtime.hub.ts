import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { WebSocket } from "ws";
import { loadActivePartnership } from "../couple/active-partnership";
import { PrismaService } from "../prisma/prisma.service";

export type RealtimeEvent = {
  event: string;
  eventId?: string;
  occurredAt?: string;
  connectionId?: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class RealtimeHub {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private readonly sockets = new Map<string, Set<WebSocket>>();

  attach(userId: string, socket: WebSocket): void {
    const current = this.sockets.get(userId) ?? new Set<WebSocket>();
    current.add(socket);
    this.sockets.set(userId, current);
    socket.on("close", () => {
      current.delete(socket);
      if (current.size === 0) {
        this.sockets.delete(userId);
        void this.announcePresence(userId, "OFFLINE");
      }
    });
    void this.announcePresence(userId, "ONLINE");
  }

  publishToUsers(userIds: string[], event: RealtimeEvent): void {
    const message = JSON.stringify({
      eventId: event.eventId ?? randomUUID(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      ...event,
    });
    for (const userId of userIds) {
      for (const socket of this.sockets.get(userId) ?? []) {
        if (socket.readyState === 1) {
          socket.send(message);
        }
      }
    }
  }

  private async announcePresence(
    userId: string,
    state: "ONLINE" | "OFFLINE",
  ): Promise<void> {
    const memberships = await this.prisma.client.connectionPartner.findMany({
      where: { userId, state: "ACTIVE", connection: { state: "ACTIVE" } },
      select: { connectionId: true },
    });
    for (const membership of memberships) {
      const partnership = await loadActivePartnership(
        this.prisma.client,
        userId,
        membership.connectionId,
      );
      if (!partnership || partnership.blocked) {
        continue;
      }
      this.publishToUsers([partnership.partnerUserId], {
        event: "presence.changed.v1",
        connectionId: membership.connectionId,
        payload: {
          userId,
          state,
          lastSeenAt: state === "OFFLINE" ? new Date().toISOString() : null,
        },
      });
    }
  }
}
