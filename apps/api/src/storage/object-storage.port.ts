export type ObjectPurpose = "avatar" | "export";

export type StoredObject = {
  purpose: ObjectPurpose;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  ownerUserId: string;
  createdAt: Date;
  deletedAt?: Date;
};

export type PutObjectInput = {
  purpose: ObjectPurpose;
  ownerUserId: string;
  contentType: string;
  body: Buffer;
};

export const AVATAR_SIGNED_URL_SECONDS = 15 * 60;
export const EXPORT_SIGNED_URL_SECONDS = 24 * 60 * 60;

export type ObjectStorageConfig =
  | {
      backend: "minio";
      endPoint: string;
      port: number;
      useSSL: boolean;
      accessKey: string;
      secretKey: string;
      avatarBucket: string;
      exportBucket: string;
    }
  | {
      backend: "gcs";
      projectId: string;
      avatarBucket: string;
      exportBucket: string;
    }
  | {
      backend: "filesystem";
      root: string;
      publicBaseUrl: string;
      signingSecret: string;
    };

export type GcsFileHandle = {
  name?: string;
  save(
    body: Buffer,
    options: {
      resumable: false;
      public: false;
      metadata: {
        contentType: string;
        contentLength: number;
        metadata: Record<string, string>;
      };
    },
  ): Promise<void>;
  getMetadata(): Promise<
    [
      {
        contentType?: string;
        size?: string | number;
        metadata?: Record<string, string>;
      },
    ]
  >;
  getSignedUrl(options: {
    version: "v4";
    action: "read" | "write";
    expires: number;
  }): Promise<[string]>;
  setMetadata(metadata: { metadata: Record<string, string> }): Promise<void>;
  delete(): Promise<void>;
};

export type GcsBucketHandle = {
  file(objectKey: string): GcsFileHandle;
  getFiles(): Promise<[GcsFileHandle[]]>;
  getMetadata(): Promise<
    [{ iamConfiguration?: { publicAccessPrevention?: string } }]
  >;
};

export type GcsSdk = {
  bucket(name: string): GcsBucketHandle;
};

export interface ObjectStoragePort {
  put(input: PutObjectInput & { objectKey: string }): Promise<StoredObject>;
  head(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<StoredObject | undefined>;
  list(purpose: ObjectPurpose): Promise<StoredObject[]>;
  signedGetUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string>;
  signedPutUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string>;
  markDeleted(purpose: ObjectPurpose, objectKey: string): Promise<void>;
  delete(purpose: ObjectPurpose, objectKey: string): Promise<void>;
  assertPrivateBuckets(): Promise<void>;
}

export const OBJECT_STORAGE = "OBJECT_STORAGE";
