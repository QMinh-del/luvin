import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import {
  PrismaClient,
  AccountState,
  ConnectionType,
  ConnectionState,
  MembershipRole,
  MembershipState,
  ConversationType,
} from "@prisma/client";

const shouldRun = process.env.RUN_INFRA_TESTS === "1";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public";

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const NOW = new Date("2026-01-15T00:00:00.000Z");

async function createUser(username: string): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      emailNormalized: `${username}@example.test`,
      passwordHash: "argon2id$synthetic$not-a-real-password-hash",
      accountState: AccountState.ACTIVE,
      dateOfBirth: new Date("1991-01-01"),
      birthDateCorrectionCount: 0,
      ageEligible: true,
      createdAt: NOW,
      updatedAt: NOW,
      profile: {
        create: {
          username,
          displayName: username,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    },
  });
  return id;
}

test(
  "empty-database migration created required tables",
  { skip: !shouldRun },
  async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
    const names = tables.map((row) => row.tablename);
    for (const required of [
      "users",
      "profiles",
      "connections",
      "connection_members",
      "conversations",
      "messages",
      "locations",
      "audit_logs",
    ]) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
  },
);

test(
  "duplicate connection membership fails",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`dup_owner_${randomUUID().slice(0, 8)}`);
    const member = await createUser(`dup_member_${randomUUID().slice(0, 8)}`);
    const connectionId = randomUUID();
    await prisma.connection.create({
      data: {
        id: connectionId,
        type: ConnectionType.COUPLE,
        state: ConnectionState.ACTIVE,
        createdByUserId: owner,
        createdAt: NOW,
        updatedAt: NOW,
        members: {
          create: {
            id: randomUUID(),
            userId: member,
            role: MembershipRole.MEMBER,
            state: MembershipState.ACTIVE,
            createdAt: NOW,
            updatedAt: NOW,
          },
        },
      },
    });
    await assert.rejects(
      () =>
        prisma.connectionMember.create({
          data: {
            id: randomUUID(),
            connectionId,
            userId: member,
            role: MembershipRole.MEMBER,
            state: MembershipState.ACTIVE,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      /Unique constraint/,
    );
  },
);

test(
  "eleventh group membership fails transactionally",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`g_owner_${randomUUID().slice(0, 8)}`);
    const connectionId = randomUUID();
    await prisma.connection.create({
      data: {
        id: connectionId,
        type: ConnectionType.GROUP,
        state: ConnectionState.ACTIVE,
        name: "capacity",
        createdByUserId: owner,
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    await prisma.connectionMember.create({
      data: {
        id: randomUUID(),
        connectionId,
        userId: owner,
        role: MembershipRole.OWNER,
        state: MembershipState.ACTIVE,
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    for (let i = 0; i < 9; i += 1) {
      const userId = await createUser(`g_m_${i}_${randomUUID().slice(0, 6)}`);
      await prisma.connectionMember.create({
        data: {
          id: randomUUID(),
          connectionId,
          userId,
          role: MembershipRole.MEMBER,
          state: MembershipState.ACTIVE,
          createdAt: NOW,
          updatedAt: NOW,
        },
      });
    }
    const eleventh = await createUser(`g_m_10_${randomUUID().slice(0, 6)}`);
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          await tx.connectionMember.create({
            data: {
              id: randomUUID(),
              connectionId,
              userId: eleventh,
              role: MembershipRole.MEMBER,
              state: MembershipState.ACTIVE,
              createdAt: NOW,
              updatedAt: NOW,
            },
          });
        }),
      /GROUP_CAPACITY_EXCEEDED/,
    );
  },
);

test("second active group Owner fails", { skip: !shouldRun }, async () => {
  const owner = await createUser(`own_a_${randomUUID().slice(0, 8)}`);
  const other = await createUser(`own_b_${randomUUID().slice(0, 8)}`);
  const connectionId = randomUUID();
  await prisma.connection.create({
    data: {
      id: connectionId,
      type: ConnectionType.GROUP,
      state: ConnectionState.ACTIVE,
      createdByUserId: owner,
      createdAt: NOW,
      updatedAt: NOW,
      members: {
        create: {
          id: randomUUID(),
          userId: owner,
          role: MembershipRole.OWNER,
          state: MembershipState.ACTIVE,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    },
  });
  await assert.rejects(
    () =>
      prisma.connectionMember.create({
        data: {
          id: randomUUID(),
          connectionId,
          userId: other,
          role: MembershipRole.OWNER,
          state: MembershipState.ACTIVE,
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    /GROUP_OWNER_UNIQUE/,
  );
});

test(
  "duplicate conversation per connection fails",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`conv_${randomUUID().slice(0, 8)}`);
    const connectionId = randomUUID();
    await prisma.connection.create({
      data: {
        id: connectionId,
        type: ConnectionType.COUPLE,
        state: ConnectionState.ACTIVE,
        createdByUserId: owner,
        createdAt: NOW,
        updatedAt: NOW,
        conversation: {
          create: {
            id: randomUUID(),
            type: ConversationType.COUPLE,
            createdAt: NOW,
            updatedAt: NOW,
          },
        },
      },
    });
    await assert.rejects(
      () =>
        prisma.conversation.create({
          data: {
            id: randomUUID(),
            connectionId,
            type: ConversationType.COUPLE,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      /Unique constraint/,
    );
  },
);

test("duplicate device sequence fails", { skip: !shouldRun }, async () => {
  const userId = await createUser(`seq_${randomUUID().slice(0, 8)}`);
  const deviceId = randomUUID();
  const connectionId = randomUUID();
  await prisma.device.create({
    data: {
      id: deviceId,
      userId,
      devicePublicId: `pub-${deviceId.slice(0, 8)}`,
      platform: "ANDROID",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  await prisma.connection.create({
    data: {
      id: connectionId,
      type: ConnectionType.COUPLE,
      state: ConnectionState.ACTIVE,
      createdByUserId: userId,
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  const location = {
    userId,
    connectionId,
    deviceId,
    capturedAt: NOW,
    receivedAt: NOW,
    latitude: 10.77,
    longitude: 106.7,
    accuracyMeters: 12.5,
    sourceIsBackground: false,
    modeAtCapture: "PAUSED" as const,
    sequence: 1n,
    createdAt: NOW,
  };
  await prisma.location.create({ data: { id: randomUUID(), ...location } });
  await assert.rejects(
    () => prisma.location.create({ data: { id: randomUUID(), ...location } }),
    /Unique constraint/,
  );
});

after(async () => {
  await prisma.$disconnect();
});
