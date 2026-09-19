import {
  PrismaClient,
  AccountState,
  ConnectionType,
  ConnectionState,
  MembershipRole,
  MembershipState,
  ConsentRequirement,
  LegalDocumentType,
  ConversationType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const NOW = new Date("2026-01-15T00:00:00.000Z");
const HASH = "argon2id$synthetic$not-a-real-password-hash";

async function main(): Promise<void> {
  await prisma.userLegalConsent.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.connectionMember.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.legalDocument.deleteMany();
  await prisma.user.deleteMany();

  const termsVi = randomUUID();
  const termsEn = randomUUID();
  const privacyVi = randomUUID();
  const privacyEn = randomUUID();

  await prisma.legalDocument.createMany({
    data: [
      {
        id: termsVi,
        documentType: LegalDocumentType.TERMS,
        version: "2026-01-01",
        language: "vi",
        contentUri: "seed://legal/terms/vi/2026-01-01",
        contentHash: "sha256:terms-vi-seed",
        effectiveAt: NOW,
        consentRequirement: ConsentRequirement.REQUIRED,
        createdAt: NOW,
      },
      {
        id: termsEn,
        documentType: LegalDocumentType.TERMS,
        version: "2026-01-01",
        language: "en",
        contentUri: "seed://legal/terms/en/2026-01-01",
        contentHash: "sha256:terms-en-seed",
        effectiveAt: NOW,
        consentRequirement: ConsentRequirement.REQUIRED,
        createdAt: NOW,
      },
      {
        id: privacyVi,
        documentType: LegalDocumentType.PRIVACY,
        version: "2026-01-01",
        language: "vi",
        contentUri: "seed://legal/privacy/vi/2026-01-01",
        contentHash: "sha256:privacy-vi-seed",
        effectiveAt: NOW,
        consentRequirement: ConsentRequirement.REQUIRED,
        createdAt: NOW,
      },
      {
        id: privacyEn,
        documentType: LegalDocumentType.PRIVACY,
        version: "2026-01-01",
        language: "en",
        contentUri: "seed://legal/privacy/en/2026-01-01",
        contentHash: "sha256:privacy-en-seed",
        effectiveAt: NOW,
        consentRequirement: ConsentRequirement.REQUIRED,
        createdAt: NOW,
      },
    ],
  });

  const userA = randomUUID();
  const userB = randomUUID();
  const userC = randomUUID();

  for (const [id, email, username, display] of [
    [userA, "seed.user.a@example.test", "seed_user_a", "Seed User A"],
    [userB, "seed.user.b@example.test", "seed_user_b", "Seed User B"],
    [userC, "seed.user.c@example.test", "seed_user_c", "Seed User C"],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        emailNormalized: email,
        passwordHash: HASH,
        accountState: AccountState.ACTIVE,
        dateOfBirth: new Date("1990-06-15"),
        birthDateCorrectionCount: 0,
        ageEligible: true,
        createdAt: NOW,
        updatedAt: NOW,
        profile: {
          create: {
            username,
            displayName: display,
            createdAt: NOW,
            updatedAt: NOW,
          },
        },
        legalConsents: {
          create: {
            id: randomUUID(),
            termsVersion: "2026-01-01",
            privacyVersion: "2026-01-01",
            acceptedAt: NOW,
            createdAt: NOW,
          },
        },
      },
    });
  }

  const coupleId = randomUUID();
  await prisma.connection.create({
    data: {
      id: coupleId,
      type: ConnectionType.COUPLE,
      state: ConnectionState.ACTIVE,
      createdByUserId: userA,
      activatedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      members: {
        create: [
          {
            id: randomUUID(),
            userId: userA,
            role: MembershipRole.MEMBER,
            state: MembershipState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: randomUUID(),
            userId: userB,
            role: MembershipRole.MEMBER,
            state: MembershipState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
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

  const groupId = randomUUID();
  await prisma.connection.create({
    data: {
      id: groupId,
      type: ConnectionType.GROUP,
      state: ConnectionState.ACTIVE,
      name: "Seed Group",
      createdByUserId: userA,
      activatedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      members: {
        create: [
          {
            id: randomUUID(),
            userId: userA,
            role: MembershipRole.OWNER,
            state: MembershipState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: randomUUID(),
            userId: userC,
            role: MembershipRole.MEMBER,
            state: MembershipState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
      conversation: {
        create: {
          id: randomUUID(),
          type: ConversationType.GROUP,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
