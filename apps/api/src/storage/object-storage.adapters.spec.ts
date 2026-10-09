import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FilesystemObjectStorage } from "./filesystem-object-storage";
import { GcsObjectStorage } from "./gcs-object-storage";
import { MemoryObjectStorage } from "./memory-object-storage";
import { MinioObjectStorage } from "./minio-object-storage";
import { createObjectKey } from "./object-key";
import type {
  GcsFileHandle,
  GcsSdk,
  ObjectStoragePort,
} from "./object-storage.port";
import { readLocalServicesConfig } from "../infra/local-services-config";

const OWNER = "11111111-1111-4111-8111-111111111111";

class FakeGcsFile implements GcsFileHandle {
  name: string;
  body = Buffer.alloc(0);
  contentType = "application/octet-stream";
  custom: Record<string, string> = {};

  constructor(name: string) {
    this.name = name;
  }

  async save(
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
  ): Promise<void> {
    this.body = body;
    this.contentType = options.metadata.contentType;
    this.custom = { ...options.metadata.metadata };
  }

  async getMetadata(): Promise<
    [
      {
        contentType?: string;
        size?: string | number;
        metadata?: Record<string, string>;
      },
    ]
  > {
    return [
      {
        contentType: this.contentType,
        size: this.body.byteLength,
        metadata: this.custom,
      },
    ];
  }

  async getSignedUrl(options: {
    version: "v4";
    action: "read" | "write";
    expires: number;
  }): Promise<[string]> {
    return [
      `gcs://${this.name}?action=${options.action}&exp=${options.expires}`,
    ];
  }

  async setMetadata(metadata: {
    metadata: Record<string, string>;
  }): Promise<void> {
    this.custom = { ...this.custom, ...metadata.metadata };
  }

  async delete(): Promise<void> {
    this.body = Buffer.alloc(0);
    this.custom = {};
  }
}

class FakeGcsBucket {
  readonly files = new Map<string, FakeGcsFile>();

  file(objectKey: string): FakeGcsFile {
    const existing = this.files.get(objectKey);
    if (existing) {
      return existing;
    }
    const created = new FakeGcsFile(objectKey);
    this.files.set(objectKey, created);
    return created;
  }

  async getFiles(): Promise<[FakeGcsFile[]]> {
    return [[...this.files.values()].filter((file) => file.custom.owneruserid)];
  }

  async getMetadata(): Promise<
    [{ iamConfiguration?: { publicAccessPrevention?: string } }]
  > {
    return [{ iamConfiguration: { publicAccessPrevention: "enforced" } }];
  }
}

class FakeGcs implements GcsSdk {
  readonly buckets = new Map<string, FakeGcsBucket>();

  bucket(name: string): FakeGcsBucket {
    const existing = this.buckets.get(name);
    if (existing) {
      return existing;
    }
    const created = new FakeGcsBucket();
    this.buckets.set(name, created);
    return created;
  }
}

async function assertAdapterContract(
  storage: ObjectStoragePort,
): Promise<void> {
  const objectKey = createObjectKey("avatar");
  const stored = await storage.put({
    purpose: "avatar",
    objectKey,
    ownerUserId: OWNER,
    contentType: "image/png",
    body: Buffer.from("png-bytes"),
  });
  assert.equal(stored.ownerUserId, OWNER);
  assert.equal(stored.objectKey.includes("@"), false);
  const head = await storage.head("avatar", objectKey);
  assert.equal(head?.ownerUserId, OWNER);
  const getUrl = await storage.signedGetUrl("avatar", objectKey, 900);
  const putUrl = await storage.signedPutUrl("avatar", objectKey, 900);
  assert.equal(getUrl.includes("png-bytes"), false);
  assert.equal(putUrl.includes("png-bytes"), false);
  await storage.markDeleted("avatar", objectKey);
  const deleted = await storage.head("avatar", objectKey);
  assert.ok(deleted?.deletedAt);
  await storage.delete("avatar", objectKey);
  assert.equal(await storage.head("avatar", objectKey), undefined);
  await storage.assertPrivateBuckets();
}

test("filesystem adapter satisfies the private object-storage contract", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "luvin-objects-"));
  try {
    const storage = new FilesystemObjectStorage({
      backend: "filesystem",
      root,
      publicBaseUrl: "https://api.example.com",
      signingSecret: "local-test-access-token-secret-32b",
    });
    await storage.assertPrivateBuckets();
    await assertAdapterContract(storage);
    const objectKey = createObjectKey("avatar");
    await storage.put({
      purpose: "avatar",
      objectKey,
      ownerUserId: OWNER,
      contentType: "image/png",
      body: Buffer.from("png-bytes"),
    });
    const url = new URL(await storage.signedGetUrl("avatar", objectKey, 900));
    assert.equal(url.origin, "https://api.example.com");
    assert.equal(url.pathname, `/v1/media/${objectKey}`);
    assert.equal(url.search.includes("png-bytes"), false);
    assert.equal(
      storage.verify(
        "GET",
        objectKey,
        Number(url.searchParams.get("exp")),
        "0".repeat(64),
      ),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("memory adapter satisfies the private object-storage contract", async () => {
  await assertAdapterContract(new MemoryObjectStorage());
});

test("GCS adapter satisfies the same private object-storage contract", async () => {
  const gcs = new FakeGcs();
  const storage = GcsObjectStorage.fromConfig(
    {
      backend: "gcs",
      projectId: "luvin-test",
      avatarBucket: "luvin-test-avatars",
      exportBucket: "luvin-test-exports",
    },
    gcs,
  );
  await assertAdapterContract(storage);
});

test("MinIO adapter satisfies the private object-storage contract", async (t) => {
  if (process.env.RUN_INFRA_TESTS !== "1") {
    t.skip("Set RUN_INFRA_TESTS=1 after docker compose is healthy");
    return;
  }
  const config = readLocalServicesConfig({
    LUVIN_ENV: "test",
    DATABASE_URL: "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test",
    REDIS_URL: "redis://127.0.0.1:6380",
    MINIO_ENDPOINT: "127.0.0.1:9100",
    MINIO_ACCESS_KEY: "luvin",
    MINIO_SECRET_KEY: "luvinminio",
  });
  await assertAdapterContract(MinioObjectStorage.fromLocalConfig(config));
});
