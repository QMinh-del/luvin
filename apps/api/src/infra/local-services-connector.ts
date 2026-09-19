import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { Client as MinioClient } from "minio";
import type { LocalServicesConfig } from "./local-services-config";

export const LOCAL_SERVICES_CONFIG = "LOCAL_SERVICES_CONFIG";

export type LocalServicesStatus = {
  postgres: boolean;
  redis: boolean;
  minio: boolean;
  avatarBucket: string;
  exportBucket: string;
};

@Injectable()
export class LocalServicesConnector {
  constructor(
    @Inject(LOCAL_SERVICES_CONFIG)
    private readonly config: LocalServicesConfig,
  ) {}

  async verify(): Promise<LocalServicesStatus> {
    await this.verifyPostgres();
    await this.verifyRedis();
    await this.verifyMinioPrivateBuckets();
    return {
      postgres: true,
      redis: true,
      minio: true,
      avatarBucket: this.config.avatarBucket,
      exportBucket: this.config.exportBucket,
    };
  }

  private async verifyPostgres(): Promise<void> {
    const prisma = new PrismaClient({
      datasources: { db: { url: this.config.databaseUrl } },
    });
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new Error("PostgreSQL is not reachable with DATABASE_URL");
    } finally {
      await prisma.$disconnect();
    }
  }

  private async verifyRedis(): Promise<void> {
    const redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      if (pong !== "PONG") {
        throw new Error("Redis ping failed");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Redis ping failed") {
        throw error;
      }
      throw new Error("Redis is not reachable with REDIS_URL");
    } finally {
      redis.disconnect();
    }
  }

  private async verifyMinioPrivateBuckets(): Promise<void> {
    const minio = new MinioClient({
      endPoint: this.config.minioEndPoint,
      port: this.config.minioPort,
      useSSL: this.config.minioUseSSL,
      accessKey: this.config.minioAccessKey,
      secretKey: this.config.minioSecretKey,
    });
    const avatarExists = await minio.bucketExists(this.config.avatarBucket);
    const exportExists = await minio.bucketExists(this.config.exportBucket);
    if (!avatarExists || !exportExists) {
      throw new Error("Required MinIO buckets are missing");
    }

    const scheme = this.config.minioUseSSL ? "https" : "http";
    const origin = `${scheme}://${this.config.minioEndPoint}:${this.config.minioPort}`;
    await assertBucketIsNotPublic(origin, this.config.avatarBucket);
    await assertBucketIsNotPublic(origin, this.config.exportBucket);
  }
}

async function assertBucketIsNotPublic(
  origin: string,
  bucket: string,
): Promise<void> {
  const response = await fetch(`${origin}/${bucket}/`);
  if (response.ok) {
    throw new Error(`MinIO bucket ${bucket} allows unauthenticated listing`);
  }
}
