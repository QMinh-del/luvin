import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

const shouldRun = process.env.RUN_INFRA_TESTS === "1";
const executeFile = promisify(execFile);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public";
const seedIds = {
  termsVi: "00000000-0000-4000-8000-000000000001",
  termsEn: "00000000-0000-4000-8000-000000000002",
  privacyVi: "00000000-0000-4000-8000-000000000003",
  privacyEn: "00000000-0000-4000-8000-000000000004",
  userA: "00000000-0000-4000-8000-000000000011",
  couple: "00000000-0000-4000-8000-000000000031",
} as const;

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function seedSnapshot(): Promise<string> {
  const [legalDocuments, users, connections] = await Promise.all([
    prisma.legalDocument.findMany({
      where: {
        id: {
          in: [
            seedIds.termsVi,
            seedIds.termsEn,
            seedIds.privacyVi,
            seedIds.privacyEn,
          ],
        },
      },
      select: { id: true, documentType: true, version: true, language: true },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({
      where: { emailNormalized: { startsWith: "seed.user." } },
      select: {
        id: true,
        emailNormalized: true,
        profile: { select: { username: true, displayName: true } },
        legalConsents: {
          select: { id: true, termsVersion: true, privacyVersion: true },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.connection.findMany({
      where: { id: seedIds.couple },
      select: {
        id: true,
        requestedByUserId: true,
        conversation: { select: { id: true } },
        partners: {
          select: { id: true, userId: true, state: true },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  return JSON.stringify({ legalDocuments, users, connections });
}

async function runSeed(): Promise<void> {
  await executeFile(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
    cwd: resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

test(
  "development seed is synthetic and recreates the same records",
  { skip: !shouldRun },
  async () => {
    await runSeed();
    const first = await seedSnapshot();

    await runSeed();
    const second = await seedSnapshot();

    assert.equal(second, first);
    assert.match(first, new RegExp(seedIds.userA));
    assert.match(first, new RegExp(seedIds.couple));
    assert.match(first, /seed\.user\.a@example\.test/);
  },
);

after(async () => {
  await prisma.$disconnect();
});
