import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeObjectKey } from "./object-key";
import {
  signMediaAccess,
  verifyMediaAccess,
  type MediaAction,
} from "./media-signature";
import type {
  ObjectPurpose,
  ObjectStorageConfig,
  ObjectStoragePort,
  PutObjectInput,
  StoredObject,
} from "./object-storage.port";

type FilesystemConfig = Extract<ObjectStorageConfig, { backend: "filesystem" }>;

type MetaFile = {
  purpose: ObjectPurpose;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  ownerUserId: string;
  createdAt: string;
  deletedAt?: string;
};

export class FilesystemObjectStorage implements ObjectStoragePort {
  constructor(private readonly config: FilesystemConfig) {}

  async put(
    input: PutObjectInput & { objectKey: string },
  ): Promise<StoredObject> {
    const createdAt = new Date();
    const stored: StoredObject = {
      purpose: input.purpose,
      bucket: "filesystem",
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      ownerUserId: input.ownerUserId,
      createdAt,
    };
    await this.writeObject(stored, input.body);
    return stored;
  }

  async head(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<StoredObject | undefined> {
    const meta = await this.readMeta(purpose, objectKey);
    return meta ? toStored(meta) : undefined;
  }

  async list(purpose: ObjectPurpose): Promise<StoredObject[]> {
    const prefix = purpose === "avatar" ? "a" : "e";
    const directory = this.resolveUnderRoot(prefix);
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }
    const items: StoredObject[] = [];
    for (const name of names) {
      if (name.endsWith(".meta.json")) {
        continue;
      }
      try {
        const stored = await this.head(purpose, `${prefix}/${name}`);
        if (stored) {
          items.push(stored);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "OBJECT_KEY_INVALID") {
          continue;
        }
        throw error;
      }
    }
    return items;
  }

  async signedGetUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    assertPurpose(purpose, objectKey);
    return this.signedUrl("GET", objectKey, expiresSeconds);
  }

  async signedPutUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    assertPurpose(purpose, objectKey);
    return this.signedUrl("PUT", objectKey, expiresSeconds);
  }

  async markDeleted(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    const current = await this.head(purpose, objectKey);
    if (!current) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    const body = await readFile(this.objectPath(objectKey));
    await this.writeObject({ ...current, deletedAt: new Date() }, body);
  }

  async delete(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    assertPurpose(purpose, objectKey);
    await rm(this.objectPath(objectKey), { force: true });
    await rm(this.metaPath(objectKey), { force: true });
  }

  async assertPrivateBuckets(): Promise<void> {
    const root = path.resolve(this.config.root);
    if (root === path.parse(root).root) {
      throw new Error("OBJECT_STORAGE_ROOT must be a dedicated directory");
    }
    await mkdir(root, { recursive: true, mode: 0o700 });
  }

  verify(
    action: MediaAction,
    objectKey: string,
    expiresAtSec: number,
    signature: string,
  ): boolean {
    return verifyMediaAccess(
      this.config.signingSecret,
      action,
      objectKey,
      expiresAtSec,
      signature,
    );
  }

  async open(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<(StoredObject & { body: Buffer }) | undefined> {
    const meta = await this.readMeta(purpose, objectKey);
    if (!meta) {
      return undefined;
    }
    const body = await readFile(this.objectPath(objectKey));
    return { ...toStored(meta), body };
  }

  async replaceBody(
    purpose: ObjectPurpose,
    objectKey: string,
    body: Buffer,
    contentType: string | undefined,
  ): Promise<StoredObject> {
    const current = await this.head(purpose, objectKey);
    if (!current || current.deletedAt) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    const stored: StoredObject = {
      ...current,
      contentType: contentType?.trim() || current.contentType,
      sizeBytes: body.byteLength,
    };
    await this.writeObject(stored, body);
    return stored;
  }

  private signedUrl(
    action: MediaAction,
    objectKey: string,
    expiresSeconds: number,
  ): string {
    const expiresAtSec =
      Math.floor(Date.now() / 1000) + Math.floor(expiresSeconds);
    const signature = signMediaAccess(
      this.config.signingSecret,
      action,
      objectKey,
      expiresAtSec,
    );
    return `${this.config.publicBaseUrl}/v1/media/${objectKey}?exp=${expiresAtSec}&sig=${signature}`;
  }

  private async writeObject(stored: StoredObject, body: Buffer): Promise<void> {
    assertPurpose(stored.purpose, stored.objectKey);
    const objectPath = this.objectPath(stored.objectKey);
    await mkdir(path.dirname(objectPath), { recursive: true, mode: 0o700 });
    await writeFile(objectPath, body, { mode: 0o600 });
    const meta: MetaFile = {
      purpose: stored.purpose,
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      ownerUserId: stored.ownerUserId,
      createdAt: stored.createdAt.toISOString(),
      deletedAt: stored.deletedAt?.toISOString(),
    };
    await writeFile(this.metaPath(stored.objectKey), JSON.stringify(meta), {
      mode: 0o600,
    });
  }

  private async readMeta(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<MetaFile | undefined> {
    assertPurpose(purpose, objectKey);
    try {
      const raw = await readFile(this.metaPath(objectKey), "utf8");
      const meta = JSON.parse(raw) as MetaFile;
      if (meta.purpose !== purpose || meta.objectKey !== objectKey) {
        return undefined;
      }
      if (!meta.ownerUserId) {
        return undefined;
      }
      return meta;
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private objectPath(objectKey: string): string {
    return this.resolveUnderRoot(objectKey);
  }

  private metaPath(objectKey: string): string {
    return this.resolveUnderRoot(`${objectKey}.meta.json`);
  }

  private resolveUnderRoot(relativePath: string): string {
    const root = path.resolve(this.config.root);
    const full = path.resolve(root, relativePath);
    const relative = path.relative(root, full);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("OBJECT_KEY_INVALID");
    }
    return full;
  }
}

function assertPurpose(purpose: ObjectPurpose, objectKey: string): void {
  assertSafeObjectKey(objectKey);
  const prefix = purpose === "avatar" ? "a/" : "e/";
  if (!objectKey.startsWith(prefix)) {
    throw new Error("OBJECT_KEY_INVALID");
  }
}

function toStored(meta: MetaFile): StoredObject {
  return {
    purpose: meta.purpose,
    bucket: meta.bucket,
    objectKey: meta.objectKey,
    contentType: meta.contentType,
    sizeBytes: meta.sizeBytes,
    ownerUserId: meta.ownerUserId,
    createdAt: new Date(meta.createdAt),
    deletedAt: meta.deletedAt ? new Date(meta.deletedAt) : undefined,
  };
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
