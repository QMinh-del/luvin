import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { DeliveryState } from "@prisma/client";
import { loadActivePartnership } from "../couple/active-partnership";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeHub } from "../realtime/realtime.hub";
import { approvedMood, normalizeDisplayName } from "./social-policy";

@Injectable()
export class SocialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeHub) private readonly realtime: RealtimeHub,
  ) {}

  async profile(userId: string) {
    const profile = await this.prisma.client.profile.findUnique({
      where: { userId },
      select: { username: true, displayName: true },
    });
    if (!profile) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return profile;
  }

  async updateProfile(userId: string, displayName: string) {
    const name = normalizeDisplayName(displayName);
    if (!name) {
      throw apiError(HttpStatus.BAD_REQUEST, "PROFILE_NAME_INVALID");
    }
    const profile = await this.prisma.client.profile.update({
      where: { userId },
      data: { displayName: name, updatedAt: new Date() },
      select: { username: true, displayName: true },
    });
    return profile;
  }

  async setMood(userId: string, moodCode: string, note: string | undefined) {
    const code = approvedMood(moodCode);
    if (!code) {
      throw apiError(HttpStatus.BAD_REQUEST, "MOOD_INVALID");
    }
    const safeNote = note?.normalize("NFKC").trim() ?? "";
    if ([...safeNote].length > 140) {
      throw apiError(HttpStatus.BAD_REQUEST, "MOOD_INVALID");
    }
    const now = new Date();
    const mood = await this.prisma.client.mood.create({
      data: {
        id: randomUUID(),
        userId,
        moodCode: code,
        note: safeNote.length === 0 ? null : safeNote,
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.notifyPartners(userId, "mood.changed.v1", {
      userId,
      moodCode: mood.moodCode,
      note: mood.note,
      updatedAt: mood.updatedAt.toISOString(),
    });
    return {
      moodCode: mood.moodCode,
      note: mood.note,
      updatedAt: mood.updatedAt.toISOString(),
    };
  }

  async clearMood(userId: string) {
    await this.prisma.client.mood.updateMany({
      where: { userId, clearedAt: null },
      data: { clearedAt: new Date(), updatedAt: new Date() },
    });
    await this.notifyPartners(userId, "mood.cleared.v1", { userId });
  }

  async moods(actorUserId: string, connectionId: string) {
    const partnership = await loadActivePartnership(
      this.prisma.client,
      actorUserId,
      connectionId,
    );
    if (!partnership || partnership.blocked) {
      return { moods: [] };
    }
    const rows = await this.prisma.client.mood.findMany({
      where: {
        userId: { in: [actorUserId, partnership.partnerUserId] },
        clearedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { userId: true, moodCode: true, note: true, updatedAt: true },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.userId)) {
        latest.set(row.userId, row);
      }
    }
    return {
      moods: [...latest.values()].map((row) => ({
        userId: row.userId,
        moodCode: row.moodCode,
        note: row.note,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async lovePing(
    actorUserId: string,
    connectionId: string,
    targetUserId: string,
    clientRequestId: string,
  ) {
    const partnership = await loadActivePartnership(
      this.prisma.client,
      actorUserId,
      connectionId,
    );
    if (!partnership) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if (partnership.blocked) {
      throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
    }
    if (targetUserId !== partnership.partnerUserId) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    const existing = await this.prisma.client.lovePing.findUnique({
      where: {
        senderUserId_clientRequestId: {
          senderUserId: actorUserId,
          clientRequestId,
        },
      },
      select: { id: true, createdAt: true },
    });
    const ping =
      existing ??
      (await this.prisma.client.lovePing.create({
        data: {
          id: randomUUID(),
          connectionId,
          senderUserId: actorUserId,
          targetUserId,
          targetAll: false,
          clientRequestId,
          createdAt: new Date(),
          deliveries: {
            create: {
              recipientUserId: targetUserId,
              state: DeliveryState.DELIVERED,
              deliveredAt: new Date(),
            },
          },
        },
        select: { id: true, createdAt: true },
      }));
    this.realtime.publishToUsers([targetUserId], {
      event: "love_ping.received.v1",
      connectionId,
      payload: {
        lovePingId: ping.id,
        connectionId,
        senderUserId: actorUserId,
        createdAt: ping.createdAt.toISOString(),
      },
    });
    return { lovePingId: ping.id };
  }

  private async notifyPartners(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
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
      this.realtime.publishToUsers([partnership.partnerUserId, userId], {
        event,
        connectionId: membership.connectionId,
        payload,
      });
    }
  }
}

function apiError(status: HttpStatus, code: string): HttpException {
  return new HttpException({ code, fields: {} }, status);
}
