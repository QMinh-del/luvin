import { Client as MinioClient } from "minio";
import type { LocalServicesConfig } from "../infra/local-services-config";
import type {
  ObjectPurpose,
  ObjectStorageConfig,
  ObjectStoragePort,
  PutObjectInput,
  StoredObject,
} from "./object-storage.port";

const OWNER_META = "owner-user-id";
const CREATED_META = "created-at";
const DELETED_META = "deleted-at";

export class MinioObjectStorage implements ObjectStoragePort {
  constructor(
    private readonly minio: MinioClient,
    private readonly buckets: { avatar: string; export: string },
    private readonly origin: string,
  ) {}

  static fromConfig(
    config: Extract<ObjectStorageConfig, { backend: "minio" }>,
  ): MinioObjectStorage {
    const scheme = config.useSSL ? "https" : "http";
    return new MinioObjectStorage(
      new MinioClient({
        endPoint: config.endPoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
      }),
      { avatar: config.avatarBucket, export: config.exportBucket },
      `${scheme}://${config.endPoint}:${config.port}`,
    );
  }

  static fromLocalConfig(config: LocalServicesConfig): MinioObjectStorage {
    return MinioObjectStorage.fromConfig({
      backend: "minio",
      endPoint: config.minioEndPoint,
      port: config.minioPort,
      useSSL: config.minioUseSSL,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
      avatarBucket: config.avatarBucket,
      exportBucket: config.exportBucket,
    });
  }

  async put(
    input: PutObjectInput & { objectKey: string },
  ): Promise<StoredObject> {
    const bucket = this.bucketName(input.purpose);
    const createdAt = new Date();
    await this.minio.putObject(
      bucket,
      input.objectKey,
      input.body,
      input.body.byteLength,
      {
        "Content-Type": input.contentType,
        [OWNER_META]: input.ownerUserId,
        [CREATED_META]: createdAt.toISOString(),
      },
    );
    return {
      purpose: input.purpose,
      bucket,
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      ownerUserId: input.ownerUserId,
      createdAt,
    };
  }

  async head(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<StoredObject | undefined> {
    const bucket = this.bucketName(purpose);
    try {
      const stat = await this.minio.statObject(bucket, objectKey);
      return fromMeta(
        purpose,
        bucket,
        objectKey,
        stat.metaData ?? {},
        stat.size,
      );
    } catch {
      return undefined;
    }
  }

  async list(purpose: ObjectPurpose): Promise<StoredObject[]> {
    const bucket = this.bucketName(purpose);
    const keys = await listObjectKeys(this.minio, bucket);
    const items: StoredObject[] = [];
    for (const objectKey of keys) {
      const stored = await this.head(purpose, objectKey);
      if (stored) {
        items.push(stored);
      }
    }
    return items;
  }

  async signedGetUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    return this.minio.presignedGetObject(
      this.bucketName(purpose),
      objectKey,
      expiresSeconds,
    );
  }

  async signedPutUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    return this.minio.presignedPutObject(
      this.bucketName(purpose),
      objectKey,
      expiresSeconds,
    );
  }

  async markDeleted(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    const current = await this.head(purpose, objectKey);
    if (!current) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    const body = await this.minio.getObject(
      this.bucketName(purpose),
      objectKey,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await this.minio.putObject(
      this.bucketName(purpose),
      objectKey,
      Buffer.concat(chunks),
      current.sizeBytes,
      {
        "Content-Type": current.contentType,
        [OWNER_META]: current.ownerUserId,
        [CREATED_META]: current.createdAt.toISOString(),
        [DELETED_META]: new Date().toISOString(),
      },
    );
  }

  async delete(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    await this.minio.removeObject(this.bucketName(purpose), objectKey);
  }

  async assertPrivateBuckets(): Promise<void> {
    const avatarExists = await this.minio.bucketExists(this.buckets.avatar);
    const exportExists = await this.minio.bucketExists(this.buckets.export);
    if (!avatarExists || !exportExists) {
      throw new Error("Required object-storage buckets are missing");
    }
    await assertBucketIsNotPublic(this.origin, this.buckets.avatar);
    await assertBucketIsNotPublic(this.origin, this.buckets.export);
  }

  private bucketName(purpose: ObjectPurpose): string {
    return purpose === "avatar" ? this.buckets.avatar : this.buckets.export;
  }
}

function fromMeta(
  purpose: ObjectPurpose,
  bucket: string,
  objectKey: string,
  meta: Record<string, string>,
  size: number,
): StoredObject | undefined {
  const ownerUserId = meta[OWNER_META] ?? meta["Owner-User-Id"];
  if (!ownerUserId) {
    return undefined;
  }
  const createdRaw = meta[CREATED_META] ?? meta["Created-At"];
  const deletedRaw = meta[DELETED_META] ?? meta["Deleted-At"];
  return {
    purpose,
    bucket,
    objectKey,
    contentType:
      meta["content-type"] ??
      meta["Content-Type"] ??
      "application/octet-stream",
    sizeBytes: size,
    ownerUserId,
    createdAt: createdRaw ? new Date(createdRaw) : new Date(0),
    deletedAt: deletedRaw ? new Date(deletedRaw) : undefined,
  };
}

function listObjectKeys(minio: MinioClient, bucket: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const stream = minio.listObjectsV2(bucket, "", true);
    stream.on("data", (item) => {
      if (item.name) {
        keys.push(item.name);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(keys));
  });
}

async function assertBucketIsNotPublic(
  origin: string,
  bucket: string,
): Promise<void> {
  const response = await fetch(`${origin}/${bucket}/`);
  if (response.ok) {
    throw new Error(
      `Object-storage bucket ${bucket} allows unauthenticated listing`,
    );
  }
}
