import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";
import { applyDatabaseSsl, materializeCaFile } from "../config/host-runtime";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const caFile = materializeCaFile("database", config.databaseSslCa);
    this.client = new PrismaClient({
      datasources: {
        db: { url: applyDatabaseSsl(config.databaseUrl, caFile) },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
