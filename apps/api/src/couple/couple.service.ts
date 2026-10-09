import { createHash, randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  AuditActorType,
  ConnectionState,
  CouplePartnerState,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  PAIRING_CODE_TTL_MS,
  coupleRequestAllowed,
  generatePairingCode,
  hashPairingCode,
  normalizeCoupleUsername,
  normalizePairingCode,
  pairingCodeActive,
} from "./couple-policy";

type CouplePartner = {
  userId: string;
  username: string;
  displayName: string;
  membershipState: CouplePartnerState;
};

export type CoupleView = {
  connectionId: string;
  state: ConnectionState;
  invitationId: string | null;
  partners: CouplePartner[];
};

export type PairingCodeIssue = {
  code: string;
  expiresAt: string;
};

export type PairingCodeStatus = {
  active: boolean;
  expiresAt: string | null;
};

type Db = Prisma.TransactionClient | PrismaService["client"];

const OPEN_CONNECTION: ConnectionState[] = [
  ConnectionState.PENDING,
  ConnectionState.ACTIVE,
];
const OPEN_MEMBERSHIP: CouplePartnerState[] = [
  CouplePartnerState.INVITED,
  CouplePartnerState.ACTIVE,
];

@Injectable()
export class CoupleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(actorUserId: string): Promise<CoupleView[]> {
    const rows = await this.prisma.client.connectionPartner.findMany({
      where: {
        userId: actorUserId,
        state: { in: OPEN_MEMBERSHIP },
        connection: {
          state: { in: OPEN_CONNECTION },
        },
      },
      select: { connectionId: true },
    });
    const views: CoupleView[] = [];
    for (const row of rows) {
      const view = await this.readCouple(row.connectionId, actorUserId);
      if (view) {
        views.push(view);
      }
    }
    return views;
  }

  async read(actorUserId: string, connectionId: string): Promise<CoupleView> {
    const view = await this.readCouple(connectionId, actorUserId);
    if (!view) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return view;
  }

  async requestCouple(
    actorUserId: string,
    username: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CoupleView> {
    const normalized = normalizeCoupleUsername(username);
    if (!normalized) {
      throw apiError(HttpStatus.BAD_REQUEST, "COUPLE_USERNAME_INVALID");
    }
    return this.once(
      actorUserId,
      "couple.request",
      idempotencyKey,
      hashBody({ username: normalized }),
      async (tx) => {
        const target = await tx.profile.findUnique({
          where: { username: normalized },
          include: { user: { select: { id: true, accountState: true } } },
        });
        if (!target || target.user.accountState !== "ACTIVE") {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        const blocked = await tx.userBlock.findFirst({
          where: {
            revokedAt: null,
            OR: [
              { blockerUserId: actorUserId, blockedUserId: target.userId },
              { blockerUserId: target.userId, blockedUserId: actorUserId },
            ],
          },
          select: { id: true },
        });
        const decision = coupleRequestAllowed({
          actorUserId,
          targetUserId: target.userId,
          blocked: blocked !== null,
          actorHasOpenCouple: await this.hasOpenCouple(tx, actorUserId),
          targetHasOpenCouple: await this.hasOpenCouple(tx, target.userId),
        });
        if (decision === "self") {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_SELF");
        }
        if (decision === "blocked") {
          throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
        }
        if (decision === "busy") {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_ALREADY_CONNECTED");
        }
        return this.createPendingCouple(
          tx,
          actorUserId,
          target.userId,
          correlationId,
          "couple.request",
        );
      },
    );
  }

  async createPairingCode(
    actorUserId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<PairingCodeIssue> {
    return this.once(
      actorUserId,
      "couple.pairing.create",
      idempotencyKey,
      hashBody({ intent: "pairing" }),
      async (tx) => {
        if (await this.hasOpenCouple(tx, actorUserId)) {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_ALREADY_CONNECTED");
        }
        const now = new Date();
        await tx.pairingCode.updateMany({
          where: {
            ownerUserId: actorUserId,
            consumedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
        const code = await this.insertPairingCode(tx, actorUserId, now);
        await this.audit(tx, {
          actorUserId,
          action: "couple.pairing.create",
          connectionId: null,
          correlationId,
        });
        return code;
      },
    );
  }

  async currentPairingCode(actorUserId: string): Promise<PairingCodeStatus> {
    const row = await this.prisma.client.pairingCode.findFirst({
      where: {
        ownerUserId: actorUserId,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true },
    });
    return {
      active: row !== null,
      expiresAt: row ? row.expiresAt.toISOString() : null,
    };
  }

  async redeemPairingCode(
    actorUserId: string,
    code: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CoupleView> {
    const normalized = normalizePairingCode(code);
    if (!normalized) {
      throw apiError(HttpStatus.NOT_FOUND, "PAIRING_CODE_INVALID");
    }
    const codeHash = hashPairingCode(normalized);
    return this.once(
      actorUserId,
      "couple.pairing.redeem",
      idempotencyKey,
      hashBody({ codeHash }),
      async (tx) => {
        const row = await tx.pairingCode.findUnique({
          where: { codeHash },
        });
        const now = new Date();
        if (
          !row ||
          !pairingCodeActive({
            expiresAt: row.expiresAt,
            consumedAt: row.consumedAt,
            revokedAt: row.revokedAt,
            now,
          })
        ) {
          throw apiError(HttpStatus.NOT_FOUND, "PAIRING_CODE_INVALID");
        }
        const owner = await tx.user.findUnique({
          where: { id: row.ownerUserId },
          select: { accountState: true },
        });
        if (!owner || owner.accountState !== "ACTIVE") {
          throw apiError(HttpStatus.NOT_FOUND, "PAIRING_CODE_INVALID");
        }
        const blocked = await tx.userBlock.findFirst({
          where: {
            revokedAt: null,
            OR: [
              { blockerUserId: actorUserId, blockedUserId: row.ownerUserId },
              { blockerUserId: row.ownerUserId, blockedUserId: actorUserId },
            ],
          },
          select: { id: true },
        });
        const decision = coupleRequestAllowed({
          actorUserId: row.ownerUserId,
          targetUserId: actorUserId,
          blocked: blocked !== null,
          actorHasOpenCouple: await this.hasOpenCouple(tx, row.ownerUserId),
          targetHasOpenCouple: await this.hasOpenCouple(tx, actorUserId),
        });
        if (decision === "self") {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_SELF");
        }
        if (decision === "blocked") {
          throw apiError(HttpStatus.FORBIDDEN, "COUPLE_BLOCKED");
        }
        if (decision === "busy") {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_ALREADY_CONNECTED");
        }
        const created = await this.createPendingCouple(
          tx,
          row.ownerUserId,
          actorUserId,
          correlationId,
          "couple.pairing.redeem",
          actorUserId,
          row.id,
        );
        const consumed = await tx.pairingCode.updateMany({
          where: {
            id: row.id,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            consumedAt: now,
            connectionId: created.connectionId,
          },
        });
        if (consumed.count !== 1) {
          throw apiError(HttpStatus.NOT_FOUND, "PAIRING_CODE_INVALID");
        }
        return this.requireCouple(created.connectionId, actorUserId, tx);
      },
    );
  }

  async accept(
    actorUserId: string,
    invitationId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CoupleView> {
    return this.once(
      actorUserId,
      "couple.accept",
      idempotencyKey,
      hashBody({ invitationId }),
      async (tx) => {
        const invitation = await tx.connectionPartner.findUnique({
          where: { id: invitationId },
          include: { connection: true },
        });
        if (
          !invitation ||
          invitation.userId !== actorUserId ||
          invitation.state !== CouplePartnerState.INVITED ||
          invitation.connection.state !== ConnectionState.PENDING
        ) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        const partnerCount = await tx.connectionPartner.count({
          where: { connectionId: invitation.connectionId },
        });
        if (partnerCount !== 2) {
          throw apiError(HttpStatus.CONFLICT, "COUPLE_STATE_CONFLICT");
        }
        const now = new Date();
        await tx.connectionPartner.update({
          where: { id: invitation.id },
          data: {
            state: CouplePartnerState.ACTIVE,
            joinedAt: now,
            updatedAt: now,
          },
        });
        await tx.connection.update({
          where: { id: invitation.connectionId },
          data: {
            state: ConnectionState.ACTIVE,
            activatedAt: now,
            updatedAt: now,
          },
        });
        await tx.conversation.create({
          data: {
            id: randomUUID(),
            connectionId: invitation.connectionId,
            createdAt: now,
            updatedAt: now,
          },
        });
        await this.audit(tx, {
          actorUserId,
          action: "couple.accept",
          connectionId: invitation.connectionId,
          correlationId,
        });
        return this.requireCouple(invitation.connectionId, actorUserId, tx);
      },
    );
  }

  async reject(
    actorUserId: string,
    invitationId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CoupleView> {
    return this.once(
      actorUserId,
      "couple.reject",
      idempotencyKey,
      hashBody({ invitationId }),
      async (tx) => {
        const invitation = await tx.connectionPartner.findUnique({
          where: { id: invitationId },
          include: { connection: true },
        });
        if (
          !invitation ||
          invitation.userId !== actorUserId ||
          invitation.state !== CouplePartnerState.INVITED ||
          invitation.connection.state !== ConnectionState.PENDING
        ) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        const now = new Date();
        await tx.connectionPartner.update({
          where: { id: invitation.id },
          data: { state: CouplePartnerState.LEFT, leftAt: now, updatedAt: now },
        });
        await tx.connection.update({
          where: { id: invitation.connectionId },
          data: {
            state: ConnectionState.DELETED,
            deletedAt: now,
            updatedAt: now,
          },
        });
        await this.audit(tx, {
          actorUserId,
          action: "couple.reject",
          connectionId: invitation.connectionId,
          correlationId,
        });
        return this.requireCouple(invitation.connectionId, actorUserId, tx);
      },
    );
  }

  async disconnect(
    actorUserId: string,
    connectionId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CoupleView> {
    return this.once(
      actorUserId,
      "couple.disconnect",
      idempotencyKey,
      hashBody({ connectionId }),
      async (tx) => {
        const membership = await tx.connectionPartner.findFirst({
          where: {
            connectionId,
            userId: actorUserId,
            state: CouplePartnerState.ACTIVE,
            connection: {
              state: ConnectionState.ACTIVE,
            },
          },
        });
        if (!membership) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        const now = new Date();
        await tx.connectionPartner.updateMany({
          where: { connectionId, state: CouplePartnerState.ACTIVE },
          data: { state: CouplePartnerState.LEFT, leftAt: now, updatedAt: now },
        });
        await tx.connection.update({
          where: { id: connectionId },
          data: {
            state: ConnectionState.DISCONNECTED,
            disconnectedAt: now,
            updatedAt: now,
          },
        });
        await tx.location.deleteMany({ where: { connectionId } });
        await tx.locationViewerGrant.deleteMany({ where: { connectionId } });
        await this.audit(tx, {
          actorUserId,
          action: "couple.disconnect",
          connectionId,
          correlationId,
        });
        const view = await this.readCouple(connectionId, actorUserId, tx);
        if (!view) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        return view;
      },
    );
  }

  async block(
    actorUserId: string,
    targetUserId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ blockedUserId: string; active: true }> {
    if (actorUserId === targetUserId) {
      throw apiError(HttpStatus.CONFLICT, "COUPLE_SELF");
    }
    return this.once(
      actorUserId,
      "couple.block",
      idempotencyKey,
      hashBody({ targetUserId }),
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true },
        });
        if (!target) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        const existing = await tx.userBlock.findFirst({
          where: {
            blockerUserId: actorUserId,
            blockedUserId: targetUserId,
            revokedAt: null,
          },
        });
        if (!existing) {
          await tx.userBlock.create({
            data: {
              id: randomUUID(),
              blockerUserId: actorUserId,
              blockedUserId: targetUserId,
              createdAt: new Date(),
            },
          });
        }
        const open = await tx.connection.findFirst({
          where: {
            state: ConnectionState.ACTIVE,
            AND: [
              {
                partners: {
                  some: {
                    userId: actorUserId,
                    state: CouplePartnerState.ACTIVE,
                  },
                },
              },
              {
                partners: {
                  some: {
                    userId: targetUserId,
                    state: CouplePartnerState.ACTIVE,
                  },
                },
              },
            ],
          },
          select: { id: true },
        });
        await this.audit(tx, {
          actorUserId,
          action: "couple.block",
          connectionId: open?.id ?? null,
          correlationId,
        });
        return { blockedUserId: targetUserId, active: true as const };
      },
    );
  }

  async unblock(
    actorUserId: string,
    targetUserId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<void> {
    await this.once(
      actorUserId,
      "couple.unblock",
      idempotencyKey,
      hashBody({ targetUserId }),
      async (tx) => {
        const existing = await tx.userBlock.findFirst({
          where: {
            blockerUserId: actorUserId,
            blockedUserId: targetUserId,
            revokedAt: null,
          },
        });
        if (!existing) {
          throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        await tx.userBlock.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
        await this.audit(tx, {
          actorUserId,
          action: "couple.unblock",
          connectionId: null,
          correlationId,
        });
        return { unblockedUserId: targetUserId };
      },
    );
  }

  private async createPendingCouple(
    tx: Prisma.TransactionClient,
    requesterUserId: string,
    inviteeUserId: string,
    correlationId: string,
    action: string,
    auditUserId = requesterUserId,
    preservedPairingCodeId?: string,
  ): Promise<CoupleView> {
    const now = new Date();
    const connectionId = randomUUID();
    const invitationId = randomUUID();
    await tx.pairingCode.updateMany({
      where: {
        ownerUserId: { in: [requesterUserId, inviteeUserId] },
        consumedAt: null,
        revokedAt: null,
        ...(preservedPairingCodeId
          ? { id: { not: preservedPairingCodeId } }
          : {}),
      },
      data: { revokedAt: now },
    });
    await tx.connection.create({
      data: {
        id: connectionId,
        state: ConnectionState.PENDING,
        requestedByUserId: requesterUserId,
        createdAt: now,
        updatedAt: now,
        partners: {
          create: [
            {
              id: randomUUID(),
              userId: requesterUserId,
              state: CouplePartnerState.ACTIVE,
              invitedAt: now,
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: invitationId,
              userId: inviteeUserId,
              state: CouplePartnerState.INVITED,
              invitedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
    });
    await this.audit(tx, {
      actorUserId: auditUserId,
      action,
      connectionId,
      correlationId,
    });
    return this.requireCouple(connectionId, auditUserId, tx);
  }

  private async insertPairingCode(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    now: Date,
  ): Promise<PairingCodeIssue> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generatePairingCode();
      try {
        const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS);
        await tx.pairingCode.create({
          data: {
            id: randomUUID(),
            ownerUserId,
            codeHash: hashPairingCode(code),
            expiresAt,
            createdAt: now,
          },
        });
        return { code, expiresAt: expiresAt.toISOString() };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 4
        ) {
          continue;
        }
        throw error;
      }
    }
    throw apiError(HttpStatus.CONFLICT, "COUPLE_STATE_CONFLICT");
  }

  private async once<T>(
    actorUserId: string,
    operation: string,
    idempotencyKey: string,
    requestHash: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw apiError(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED");
    }
    const replay = await this.replay(
      actorUserId,
      operation,
      idempotencyKey,
      requestHash,
    );
    if (replay) {
      return replay as T;
    }
    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          const again = await tx.idempotencyRecord.findUnique({
            where: {
              userId_operation_idempotencyKey: {
                userId: actorUserId,
                operation,
                idempotencyKey,
              },
            },
          });
          if (again) {
            if (again.requestHash !== requestHash) {
              throw apiError(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED");
            }
            return again.responseBody as T;
          }
          const body = await work(tx);
          const now = new Date();
          await tx.idempotencyRecord.create({
            data: {
              id: randomUUID(),
              userId: actorUserId,
              operation,
              idempotencyKey,
              requestHash,
              responseStatus: 200,
              responseBody: body as Prisma.InputJsonValue,
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              createdAt: now,
            },
          });
          return body;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        const stored = await this.replay(
          actorUserId,
          operation,
          idempotencyKey,
          requestHash,
        );
        if (stored) {
          return stored as T;
        }
      }
      throw error;
    }
  }

  private async replay(
    actorUserId: string,
    operation: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<unknown | null> {
    const existing = await this.prisma.client.idempotencyRecord.findUnique({
      where: {
        userId_operation_idempotencyKey: {
          userId: actorUserId,
          operation,
          idempotencyKey,
        },
      },
    });
    if (!existing) {
      return null;
    }
    if (existing.requestHash !== requestHash) {
      throw apiError(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED");
    }
    return existing.responseBody;
  }

  private async hasOpenCouple(db: Db, userId: string): Promise<boolean> {
    const row = await db.connectionPartner.findFirst({
      where: {
        userId,
        state: { in: OPEN_MEMBERSHIP },
        connection: {
          state: { in: OPEN_CONNECTION },
        },
      },
      select: { id: true },
    });
    return row !== null;
  }

  private async requireCouple(
    connectionId: string,
    actorUserId: string,
    db: Db,
  ): Promise<CoupleView> {
    const view = await this.readCouple(connectionId, actorUserId, db);
    if (!view) {
      throw apiError(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    return view;
  }

  private async readCouple(
    connectionId: string,
    actorUserId: string,
    db: Db = this.prisma.client,
  ): Promise<CoupleView | null> {
    const connection = await db.connection.findUnique({
      where: { id: connectionId },
      include: {
        partners: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { username: true, displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!connection) {
      return null;
    }
    const visible = connection.partners.some(
      (member) => member.userId === actorUserId,
    );
    if (!visible) {
      return null;
    }
    const invited = connection.partners.find(
      (member) => member.state === CouplePartnerState.INVITED,
    );
    return {
      connectionId: connection.id,
      state: connection.state,
      invitationId: invited?.id ?? null,
      partners: connection.partners.map((member) => ({
        userId: member.userId,
        username: member.user.profile?.username ?? "",
        displayName: member.user.profile?.displayName ?? "",
        membershipState: member.state,
      })),
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    input: {
      actorUserId: string;
      action: string;
      connectionId: string | null;
      correlationId: string;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: AuditActorType.USER,
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: "connection",
        resourceId: input.connectionId,
        connectionId: input.connectionId,
        result: "ALLOWED",
        metadata: {},
        correlationId: input.correlationId,
        createdAt: new Date(),
      },
    });
  }
}

function hashBody(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function apiError(status: number, code: string): HttpException {
  return new HttpException({ code, fields: {} }, status);
}
