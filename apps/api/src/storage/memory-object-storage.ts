import type {
  ObjectPurpose,
  ObjectStoragePort,
  PutObjectInput,
  StoredObject,
} from "./object-storage.port";

type Recorded = StoredObject & { body: Buffer };

export class MemoryObjectStorage implements ObjectStoragePort {
  private readonly objects = new Map<string, Recorded>();

  async put(
    input: PutObjectInput & { objectKey: string },
  ): Promise<StoredObject> {
    const stored: Recorded = {
      purpose: input.purpose,
      bucket: input.purpose,
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      ownerUserId: input.ownerUserId,
      createdAt: new Date(),
      body: input.body,
    };
    this.objects.set(id(input.purpose, input.objectKey), stored);
    return publicView(stored);
  }

  async head(
    purpose: ObjectPurpose,
    objectKey: string,
  ): Promise<StoredObject | undefined> {
    const stored = this.objects.get(id(purpose, objectKey));
    return stored ? publicView(stored) : undefined;
  }

  async list(purpose: ObjectPurpose): Promise<StoredObject[]> {
    return [...this.objects.values()]
      .filter((item) => item.purpose === purpose)
      .map(publicView);
  }

  async signedGetUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    if (!this.objects.has(id(purpose, objectKey))) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    return `memory://${purpose}/${objectKey}?action=get&exp=${expiresSeconds}`;
  }

  async signedPutUrl(
    purpose: ObjectPurpose,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    return `memory://${purpose}/${objectKey}?action=put&exp=${expiresSeconds}`;
  }

  async markDeleted(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    const stored = this.objects.get(id(purpose, objectKey));
    if (!stored) {
      throw new Error("OBJECT_NOT_FOUND");
    }
    stored.deletedAt = new Date();
  }

  async delete(purpose: ObjectPurpose, objectKey: string): Promise<void> {
    this.objects.delete(id(purpose, objectKey));
  }

  async assertPrivateBuckets(): Promise<void> {
    return;
  }
}

function id(purpose: ObjectPurpose, objectKey: string): string {
  return `${purpose}:${objectKey}`;
}

function publicView(stored: Recorded): StoredObject {
  return {
    purpose: stored.purpose,
    bucket: stored.bucket,
    objectKey: stored.objectKey,
    contentType: stored.contentType,
    sizeBytes: stored.sizeBytes,
    ownerUserId: stored.ownerUserId,
    createdAt: stored.createdAt,
    deletedAt: stored.deletedAt,
  };
}
