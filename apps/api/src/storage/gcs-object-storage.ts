import { Storage } from "@google-cloud/storage";
import type {
  GcsSdk,
  ObjectPurpose,
  ObjectStorageConfig,
  ObjectStoragePort,
  PutObjectInput,
  StoredObject,
} from "./object-storage.port";

const OWNER_META = "owneruserid";
const CREATED_META = "createdat";
const DELETED_META = "deletedat";

export class GcsObjectStorage implements ObjectStoragePort {
  constructor(
    private readonly gcs: GcsSdk,
    private readonly buckets: { avatar: string; export: string },
  ) {}

  static fromConfig(
    config: Extract<ObjectStorageConfig, { backend: "gcs" }>,
    sdk?: GcsSdk,
  ): GcsObjectStorage {
    return new GcsObjectStorage(
      sdk ??
        (new Storage({ projectId: config.projectId }) as unknown as GcsSdk),
      { avatar: config.avatarBucket, export: config.exportBucket },
    );
  }

  async put(
    input: PutObjectInput & { objectKey: string },
  ): Promise<StoredObject> {
    const bucket = this.bucketName(input.purpose);
    const createdAt = new Date();
    await this.gcs
      .bucket(bucket)
      .file(input.objectKey)
      .save(input.body, {
        resumable: false,
        public: false,
        metadata: {
          contentType: input.contentType,
          contentLength: input.body.byteLength,
          metadata: {
            [OWNER_META]: input.ownerUserId,
            [CREATED_META]: createdAt.toISOString(),
          },
        },
      });
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
      const [meta] = await this.gcs
        .bucket(bucket)
        .file(objectKey)
        .getMetadata();
      return fromGcsMeta(purpose, bucket, objectKey, meta);
    } catch {
      return undefined;
    }
  }

  async list(purpose: ObjectPurpose): Promise<StoredObject[]> {
    const bucket = this.bucketName(purpose);
    const [files] = await this.gcs.bucket(bucket).getFiles();
    const items: StoredObject[] = [];
    for (const file of files) {
      const objectKey = file.name;
      if (!objectKey) {
        continue;
      }
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
    const [url] = await this.gcs
      .bucket(this.bucketName(purpose))
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresSeconds * 1000,
      });
    return url;
  }

  async signedPutUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    const [url] = await this.gcs
      .bucket(this.bucketName(purpose))
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + expiresSeconds * 1000,
      });
    return url;
  }

  async markDeleted(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    const current = await this.head(purpose, objectKey);
    if (!current) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    const file = this.gcs.bucket(this.bucketName(purpose)).file(objectKey);
    const [meta] = await file.getMetadata();
    await file.setMetadata({
      metadata: {
        ...(meta.metadata ?? {}),
        [OWNER_META]: current.ownerUserId,
        [CREATED_META]: current.createdAt.toISOString(),
        [DELETED_META]: new Date().toISOString(),
      },
    });
  }

  async delete(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    await this.gcs.bucket(this.bucketName(purpose)).file(objectKey).delete();
  }

  async assertPrivateBuckets(): Promise<void> {
    for (const bucket of [this.buckets.avatar, this.buckets.export]) {
      const [meta] = await this.gcs.bucket(bucket).getMetadata();
      if (meta.iamConfiguration?.publicAccessPrevention !== "enforced") {
        throw new Error(`GCS bucket ${bucket} is not locked private`);
      }
    }
  }

  private bucketName(purpose: ObjectPurpose): string {
    return purpose === "avatar" ? this.buckets.avatar : this.buckets.export;
  }
}

function fromGcsMeta(
  purpose: ObjectPurpose,
  bucket: string,
  objectKey: string,
  meta: {
    contentType?: string;
    size?: string | number;
    metadata?: Record<string, string>;
  },
): StoredObject | undefined {
  const custom = meta.metadata ?? {};
  const ownerUserId = custom[OWNER_META];
  if (!ownerUserId) {
    return undefined;
  }
  const sizeBytes =
    typeof meta.size === "number"
      ? meta.size
      : Number.parseInt(String(meta.size ?? "0"), 10);
  return {
    purpose,
    bucket,
    objectKey,
    contentType: meta.contentType ?? "application/octet-stream",
    sizeBytes,
    ownerUserId,
    createdAt: custom[CREATED_META]
      ? new Date(custom[CREATED_META])
      : new Date(0),
    deletedAt: custom[DELETED_META]
      ? new Date(custom[DELETED_META])
      : undefined,
  };
}
