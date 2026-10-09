import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import {
  PrismaClient,
  AccountState,
  ConnectionState,
  CouplePartnerState,
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

async function createCouple(
  requesterId: string,
  partnerId: string,
  state: ConnectionState = ConnectionState.ACTIVE,
): Promise<string> {
  const connectionId = randomUUID();
  await prisma.connection.create({
    data: {
      id: connectionId,
      state,
      requestedByUserId: requesterId,
      activatedAt: state === ConnectionState.ACTIVE ? NOW : null,
      createdAt: NOW,
      updatedAt: NOW,
      partners: {
        create: [
          {
            id: randomUUID(),
            userId: requesterId,
            state: CouplePartnerState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: randomUUID(),
            userId: partnerId,
            state:
              state === ConnectionState.PENDING
                ? CouplePartnerState.INVITED
                : CouplePartnerState.ACTIVE,
            invitedAt: NOW,
            joinedAt: state === ConnectionState.ACTIVE ? NOW : null,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    },
  });
  return connectionId;
}

test(
  "empty-database migration created the couple-only tables",
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
      "connection_partners",
      "pairing_codes",
      "conversations",
      "messages",
      "locations",
      "audit_logs",
    ]) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
    assert.equal(names.includes("connection_members"), false);

    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type
      WHERE typname IN (
        'ConnectionType',
        'MembershipRole',
        'MembershipState',
        'ConversationType',
        'CouplePartnerState'
      )
    `;
    const enumNames = enums.map((row) => row.typname);
    assert.deepEqual(enumNames.sort(), ["CouplePartnerState"]);
  },
);

test(
  "duplicate connection partnership fails",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`dup_owner_${randomUUID().slice(0, 8)}`);
    const member = await createUser(`dup_member_${randomUUID().slice(0, 8)}`);
    const connectionId = await createCouple(owner, member);
    await assert.rejects(
      () =>
        prisma.connectionPartner.create({
          data: {
            id: randomUUID(),
            connectionId,
            userId: member,
            state: CouplePartnerState.ACTIVE,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      /Unique constraint|COUPLE_THIRD_PARTNER/,
    );
  },
);

test(
  "a third couple partner fails transactionally",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`third_a_${randomUUID().slice(0, 8)}`);
    const partner = await createUser(`third_b_${randomUUID().slice(0, 8)}`);
    const extra = await createUser(`third_c_${randomUUID().slice(0, 8)}`);
    const connectionId = await createCouple(owner, partner);
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          await tx.connectionPartner.create({
            data: {
              id: randomUUID(),
              connectionId,
              userId: extra,
              state: CouplePartnerState.ACTIVE,
              createdAt: NOW,
              updatedAt: NOW,
            },
          });
        }),
      /COUPLE_THIRD_PARTNER/,
    );
  },
);

test(
  "a second pending or active couple for the same user fails",
  { skip: !shouldRun },
  async () => {
    const userA = await createUser(`open_a_${randomUUID().slice(0, 8)}`);
    const userB = await createUser(`open_b_${randomUUID().slice(0, 8)}`);
    const userC = await createUser(`open_c_${randomUUID().slice(0, 8)}`);
    await createCouple(userA, userB, ConnectionState.ACTIVE);
    await assert.rejects(
      () => createCouple(userA, userC, ConnectionState.PENDING),
      /COUPLE_ALREADY_OPEN/,
    );
  },
);

test(
  "concurrent couple creation cannot give either user a second open couple",
  { skip: !shouldRun },
  async () => {
    const userA = await createUser(`race_a_${randomUUID().slice(0, 8)}`);
    const userB = await createUser(`race_b_${randomUUID().slice(0, 8)}`);
    const userC = await createUser(`race_c_${randomUUID().slice(0, 8)}`);
    const first = createCouple(userA, userB, ConnectionState.PENDING);
    const second = createCouple(userA, userC, ConnectionState.PENDING);
    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const reason =
      rejected[0].status === "rejected" ? rejected[0].reason : null;
    assert.match(String(reason), /COUPLE_ALREADY_OPEN/);
  },
);

test(
  "duplicate conversation per connection fails",
  { skip: !shouldRun },
  async () => {
    const owner = await createUser(`conv_${randomUUID().slice(0, 8)}`);
    const partner = await createUser(`conv_p_${randomUUID().slice(0, 8)}`);
    const connectionId = await createCouple(owner, partner);
    await prisma.conversation.create({
      data: {
        id: randomUUID(),
        connectionId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    await assert.rejects(
      () =>
        prisma.conversation.create({
          data: {
            id: randomUUID(),
            connectionId,
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
  const partnerId = await createUser(`seq_p_${randomUUID().slice(0, 8)}`);
  const deviceId = randomUUID();
  const connectionId = await createCouple(userId, partnerId);
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
