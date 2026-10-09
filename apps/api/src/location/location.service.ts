import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  AuditActorType,
  LocationMode,
  LocationRetention,
} from "@prisma/client";
import { loadActivePartnership } from "../couple/active-partnership";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeHub } from "../realtime/realtime.hub";
import {
  grantTargetAllowed,
  locationPublishAllowed,
  locationVisible,
} from "./location-policy";

export type LocationSettingsView = {
  mode: LocationMode;
  retention: LocationRetention;
  backgroundEnabled: boolean;
  viewerUserIds: string[];
};

export type PartnerLocationView = {
  userId: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
} | null;

@Injectable()
export class LocationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeHub) private readonly realtime: RealtimeHub,
  ) {}

  async readSettings(actorUserId: string): Promise<LocationSettingsView> {
    const settings = await this.ensureSettings(actorUserId);
    const grants = await this.prisma.client.locationViewerGrant.findMany({
      where: { ownerUserId: actorUserId, revokedAt: null },
      select: { viewerUserId: true },
    });
    return {
      mode: settings.mode,
      retention: settings.retention,
      backgroundEnabled: settings.backgroundEnabled,
      viewerUserIds: grants.map((grant) => grant.viewerUserId),
    };
  }

  async updateMode(
    actorUserId: string,
    mode: "LIVE" | "GHOST" | "PAUSED",
  ): Promise<LocationSettingsView> {
    const now = new Date();
    const stored =
      mode === "LIVE"
        ? LocationMode.LIVE
        : mode === "GHOST"
          ? LocationMode.GHOST
          : LocationMode.PAUSED;
    await this.prisma.client.locationSettings.upsert({
      where: { userId: actorUserId },
      create: {
        userId: actorUserId,
        mode: stored,
        retention: LocationRetention.SEVEN_DAYS,
        backgroundEnabled: false,
        updatedAt: now,
      },
      update: {
        mode: stored,
        updatedAt: now,
      },
    });
    await this.notifyMode(actorUserId, mode);
    return this.readSettings(actorUserId);
  }

  async grant(
    actorUserId: string,
    connectionId: string,
    viewerUserId: string,
    correlationId: string,
  ): Promise<{ viewerUserId: string }> {
    const partnership = await this.requirePartnership(
      actorUserId,
      connectionId,
    );
    const decision = grantTargetAllowed({
      actorUserId,
      viewerUserId,
      partnerUserId: partnership.partnerUserId,
    });
    if (decision === "self") {
      throw apiError(HttpStatus.CONFLICT, "COUPLE_SELF");
    }
    if (decision === "not-partner") {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if (partnership.blocked) {
      throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
    }
    const now = new Date();
    const existing = await this.prisma.client.locationViewerGrant.findFirst({
      where: { connectionId, ownerUserId: actorUserId, viewerUserId },
      orderBy: { grantedAt: "desc" },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.client.locationViewerGrant.update({
        where: { id: existing.id },
        data: { revokedAt: null, grantedAt: now },
      });
    } else {
      await this.prisma.client.locationViewerGrant.create({
        data: {
          id: randomUUID(),
          connectionId,
          ownerUserId: actorUserId,
          viewerUserId,
          grantedAt: now,
        },
      });
    }
    await this.audit(
      actorUserId,
      connectionId,
      "location.grant",
      correlationId,
    );
    return { viewerUserId };
  }

  async revoke(
    actorUserId: string,
    connectionId: string,
    viewerUserId: string,
    correlationId: string,
  ): Promise<void> {
    await this.requirePartnership(actorUserId, connectionId);
    await this.prisma.client.locationViewerGrant.updateMany({
      where: {
        connectionId,
        ownerUserId: actorUserId,
        viewerUserId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await this.audit(
      actorUserId,
      connectionId,
      "location.revoke",
      correlationId,
    );
  }

  async publish(
    actorUserId: string,
    deviceId: string,
    connectionId: string,
    input: {
      capturedAt: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      sequence: number;
      source: "FOREGROUND" | "BACKGROUND";
    },
  ): Promise<{ accepted: true }> {
    const partnership = await this.requirePartnership(
      actorUserId,
      connectionId,
    );
    const settings = await this.ensureSettings(actorUserId);
    const grant = await this.prisma.client.locationViewerGrant.findFirst({
      where: {
        connectionId,
        ownerUserId: actorUserId,
        viewerUserId: partnership.partnerUserId,
        revokedAt: null,
      },
      select: { id: true },
    });
    const last = await this.prisma.client.location.findFirst({
      where: { deviceId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const decision = locationPublishAllowed({
      mode: settings.mode,
      granted: grant !== null,
      blocked: partnership.blocked,
      sequence: input.sequence,
      lastSequence: last?.sequence ?? null,
      capturedAt: new Date(input.capturedAt),
      now: new Date(),
    });
    if (decision === "blocked") {
      throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
    }
    if (decision === "hidden") {
      throw apiError(HttpStatus.FORBIDDEN, "LOCATION_NOT_GRANTED");
    }
    if (decision === "paused") {
      throw apiError(HttpStatus.CONFLICT, "LOCATION_PAUSED");
    }
    if (decision === "replay") {
      throw apiError(HttpStatus.CONFLICT, "LOCATION_REPLAY");
    }
    if (decision === "stale") {
      throw apiError(HttpStatus.CONFLICT, "LOCATION_STALE");
    }
    const now = new Date();
    await this.prisma.client.location.create({
      data: {
        id: randomUUID(),
        userId: actorUserId,
        connectionId,
        deviceId,
        capturedAt: new Date(input.capturedAt),
        receivedAt: now,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        sourceIsBackground: input.source === "BACKGROUND",
        modeAtCapture: LocationMode.LIVE,
        sequence: BigInt(input.sequence),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
      },
    });
    this.realtime.publishToUsers([partnership.partnerUserId], {
      event: "location.partner.updated.v1",
      connectionId,
      payload: {
        subjectUserId: actorUserId,
        mode: "LIVE",
        capturedAt: new Date(input.capturedAt).toISOString(),
        coordinate: {
          latitude: input.latitude,
          longitude: input.longitude,
        },
        accuracyMeters: input.accuracyMeters,
        stale: false,
      },
    });
    return { accepted: true };
  }

  async latest(
    actorUserId: string,
    connectionId: string,
  ): Promise<{ partner: PartnerLocationView }> {
    const partnership = await this.requirePartnership(
      actorUserId,
      connectionId,
    );
    if (partnership.blocked) {
      return { partner: null };
    }
    const grant = await this.prisma.client.locationViewerGrant.findFirst({
      where: {
        connectionId,
        ownerUserId: partnership.partnerUserId,
        viewerUserId: actorUserId,
        revokedAt: null,
      },
      select: { id: true },
    });
    const settings = await this.prisma.client.locationSettings.findUnique({
      where: { userId: partnership.partnerUserId },
      select: { mode: true },
    });
    const row = await this.prisma.client.location.findFirst({
      where: { connectionId, userId: partnership.partnerUserId },
      orderBy: { capturedAt: "desc" },
      select: { latitude: true, longitude: true, capturedAt: true },
    });
    if (!row || !settings) {
      return { partner: null };
    }
    const visible = locationVisible({
      granted: grant !== null,
      blocked: false,
      mode: settings.mode,
      capturedAt: row.capturedAt,
      now: new Date(),
    });
    if (!visible) {
      return { partner: null };
    }
    return {
      partner: {
        userId: partnership.partnerUserId,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        capturedAt: row.capturedAt.toISOString(),
      },
    };
  }

  private async ensureSettings(userId: string) {
    return this.prisma.client.locationSettings.upsert({
      where: { userId },
      create: {
        userId,
        mode: LocationMode.PAUSED,
        retention: LocationRetention.SEVEN_DAYS,
        backgroundEnabled: false,
        updatedAt: new Date(),
      },
      update: {},
    });
  }

  private async notifyMode(
    actorUserId: string,
    mode: "LIVE" | "GHOST" | "PAUSED",
  ): Promise<void> {
    const memberships = await this.prisma.client.connectionPartner.findMany({
      where: {
        userId: actorUserId,
        state: "ACTIVE",
        connection: { state: "ACTIVE" },
      },
      select: { connectionId: true },
    });
    for (const membership of memberships) {
      const partnership = await loadActivePartnership(
        this.prisma.client,
        actorUserId,
        membership.connectionId,
      );
      if (!partnership || partnership.blocked) {
        continue;
      }
      this.realtime.publishToUsers([partnership.partnerUserId], {
        event: "location.mode.changed.v1",
        connectionId: membership.connectionId,
        payload: { subjectUserId: actorUserId, mode },
      });
    }
  }

  private async requirePartnership(actorUserId: string, connectionId: string) {
    const partnership = await loadActivePartnership(
      this.prisma.client,
      actorUserId,
      connectionId,
    );
    if (!partnership) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return partnership;
  }

  private async audit(
    actorUserId: string,
    connectionId: string,
    action: string,
    correlationId: string,
  ): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: AuditActorType.USER,
        actorUserId,
        action,
        resourceType: "connection",
        resourceId: connectionId,
        connectionId,
        result: "ALLOWED",
        metadata: {},
        correlationId,
        createdAt: new Date(),
      },
    });
  }
}

function apiError(status: HttpStatus, code: string): HttpException {
  return new HttpException({ code, fields: {} }, status);
}
