import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StructuredLogger } from "../observability/structured-logger";
import {
  AVATAR_SIGNED_URL_SECONDS,
  EXPORT_SIGNED_URL_SECONDS,
  OBJECT_STORAGE,
  type ObjectPurpose,
  type ObjectStoragePort,
  type StoredObject,
} from "./object-storage.port";
import { assertSafeObjectKey, createObjectKey } from "./object-key";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

@Injectable()
export class ObjectStorageService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async putOwned(input: {
    purpose: ObjectPurpose;
    ownerUserId: string;
    contentType: string;
    body: Buffer;
    requestId: string;
  }): Promise<StoredObject> {
    const max =
      input.purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_EXPORT_BYTES;
    if (input.body.byteLength === 0 || input.body.byteLength > max) {
      throw new HttpException(
        { code: "VALIDATION_FAILED", fields: { contentLength: ["invalid"] } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const objectKey = createObjectKey(input.purpose);
    assertSafeObjectKey(objectKey);
    const stored = await this.storage.put({
      purpose: input.purpose,
      ownerUserId: input.ownerUserId,
      contentType: input.contentType,
      body: input.body,
      objectKey,
    });
    await this.audit({
      actorType: "USER",
      actorUserId: input.ownerUserId,
      action: "storage.object.created",
      requestId: input.requestId,
    });
    this.logger.writeEvent("INFO", "storage.object.created", {
      requestId: input.requestId,
      purpose: input.purpose,
    });
    return stored;
  }

  async signedReadUrl(input: {
    purpose: ObjectPurpose;
    objectKey: string;
    requesterUserId: string;
    requestId: string;
  }): Promise<{ url: string; expiresSeconds: number }> {
    const stored = await this.requireOwned(input);
    if (stored.deletedAt) {
      throw new HttpException(
        { code: "NOT_FOUND", fields: {} },
        HttpStatus.NOT_FOUND,
      );
    }
    const expiresSeconds =
      input.purpose === "avatar"
        ? AVATAR_SIGNED_URL_SECONDS
        : EXPORT_SIGNED_URL_SECONDS;
    const url = await this.storage.signedGetUrl(
      input.purpose,
      input.objectKey,
      expiresSeconds,
    );
    this.logger.writeEvent("INFO", "storage.object.signed", {
      requestId: input.requestId,
      purpose: input.purpose,
    });
    return { url, expiresSeconds };
  }

  async signedWriteUrl(input: {
    purpose: ObjectPurpose;
    requesterUserId: string;
    requestId: string;
  }): Promise<{ objectKey: string; url: string; expiresSeconds: number }> {
    const objectKey = createObjectKey(input.purpose);
    assertSafeObjectKey(objectKey);
    const expiresSeconds =
      input.purpose === "avatar"
        ? AVATAR_SIGNED_URL_SECONDS
        : EXPORT_SIGNED_URL_SECONDS;
    const url = await this.storage.signedPutUrl(
      input.purpose,
      objectKey,
      expiresSeconds,
    );
    this.logger.writeEvent("INFO", "storage.object.signed_put", {
      requestId: input.requestId,
      purpose: input.purpose,
    });
    return { objectKey, url, expiresSeconds };
  }

  async deleteOwned(input: {
    purpose: ObjectPurpose;
    objectKey: string;
    requesterUserId: string;
    requestId: string;
  }): Promise<void> {
    await this.requireOwned(input);
    await this.storage.markDeleted(input.purpose, input.objectKey);
    await this.audit({
      actorType: "USER",
      actorUserId: input.requesterUserId,
      action: "storage.object.deleted",
      requestId: input.requestId,
    });
    this.logger.writeEvent("INFO", "storage.object.deleted", {
      requestId: input.requestId,
      purpose: input.purpose,
    });
  }

  async purgeDue(now: Date, requestId: string): Promise<number> {
    let purged = 0;
    const avatars = await this.storage.list("avatar");
    for (const item of avatars) {
      if (item.deletedAt) {
        await this.storage.delete("avatar", item.objectKey);
        purged += 1;
      }
    }
    const exports = await this.storage.list("export");
    const exportDeadlineMs = EXPORT_SIGNED_URL_SECONDS * 1000;
    for (const item of exports) {
      const expired =
        now.getTime() - item.createdAt.getTime() >= exportDeadlineMs;
      if (item.deletedAt || expired) {
        await this.storage.delete("export", item.objectKey);
        purged += 1;
      }
    }
    if (purged > 0) {
      await this.audit({
        actorType: "SYSTEM_JOB",
        actorUserId: null,
        action: "storage.object.purged",
        requestId,
      });
      this.logger.writeEvent("INFO", "storage.object.purged", {
        requestId,
        count: purged,
      });
    }
    return purged;
  }

  async assertPrivateBuckets(): Promise<void> {
    await this.storage.assertPrivateBuckets();
  }

  private async requireOwned(input: {
    purpose: ObjectPurpose;
    objectKey: string;
    requesterUserId: string;
  }): Promise<StoredObject> {
    try {
      assertSafeObjectKey(input.objectKey);
    } catch {
      throw new HttpException(
        { code: "NOT_FOUND", fields: {} },
        HttpStatus.NOT_FOUND,
      );
    }
    const stored = await this.storage.head(input.purpose, input.objectKey);
    if (!stored || stored.ownerUserId !== input.requesterUserId) {
      throw new HttpException(
        { code: "NOT_FOUND", fields: {} },
        HttpStatus.NOT_FOUND,
      );
    }
    return stored;
  }

  private async audit(input: {
    actorType: "USER" | "SYSTEM_JOB";
    actorUserId: string | null;
    action: string;
    requestId: string;
  }): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? undefined,
        action: input.action,
        resourceType: "object",
        result: "ALLOWED",
        metadata: {},
        correlationId: input.requestId,
        createdAt: new Date(),
      },
    });
  }
}
