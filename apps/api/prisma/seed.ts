import {
  PrismaClient,
  AccountState,
  ConnectionState,
  CouplePartnerState,
  ConsentRequirement,
  LegalDocumentType,
} from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date("2026-01-15T00:00:00.000Z");
const HASH = "argon2id$synthetic$not-a-real-password-hash";
const SEED_IDS = {
  termsVi: "00000000-0000-4000-8000-000000000001",
  termsEn: "00000000-0000-4000-8000-000000000002",
  privacyVi: "00000000-0000-4000-8000-000000000003",
  privacyEn: "00000000-0000-4000-8000-000000000004",
  userA: "00000000-0000-4000-8000-000000000011",
  userB: "00000000-0000-4000-8000-000000000012",
  userC: "00000000-0000-4000-8000-000000000013",
  userAConsent: "00000000-0000-4000-8000-000000000021",
  userBConsent: "00000000-0000-4000-8000-000000000022",
  userCConsent: "00000000-0000-4000-8000-000000000023",
  couple: "00000000-0000-4000-8000-000000000031",
  coupleMemberA: "00000000-0000-4000-8000-000000000032",
  coupleMemberB: "00000000-0000-4000-8000-000000000033",
  coupleConversation: "00000000-0000-4000-8000-000000000034",
} as const;
const SEED_EMAILS = [
  "seed.user.a@example.test",
  "seed.user.b@example.test",
  "seed.user.c@example.test",
];
const SEED_LEGAL_CONTENT_URIS = [
  "seed://legal/terms/vi/2026-01-01",
  "seed://legal/terms/en/2026-01-01",
  "seed://legal/privacy/vi/2026-01-01",
  "seed://legal/privacy/en/2026-01-01",
];

async function seedDatabase(client: PrismaClient = prisma): Promise<void> {
  await client.userLegalConsent.deleteMany({
    where: { user: { emailNormalized: { in: SEED_EMAILS } } },
  });
  await client.connection.deleteMany({
    where: { requestedBy: { emailNormalized: { in: SEED_EMAILS } } },
  });
  await client.profile.deleteMany({
    where: { user: { emailNormalized: { in: SEED_EMAILS } } },
  });
  await client.legalDocument.deleteMany({
    where: { contentUri: { in: SEED_LEGAL_CONTENT_URIS } },
  });
  await client.user.deleteMany({
    where: { emailNormalized: { in: SEED_EMAILS } },
  });

  await client.legalDocument.createMany({
    data: [
      {
        id: SEED_IDS.termsVi,
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
        id: SEED_IDS.termsEn,
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
        id: SEED_IDS.privacyVi,
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
        id: SEED_IDS.privacyEn,
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

  for (const [id, consentId, email, username, display] of [
    [
      SEED_IDS.userA,
      SEED_IDS.userAConsent,
      "seed.user.a@example.test",
      "seed_user_a",
      "Seed User A",
    ],
    [
      SEED_IDS.userB,
      SEED_IDS.userBConsent,
      "seed.user.b@example.test",
      "seed_user_b",
      "Seed User B",
    ],
    [
      SEED_IDS.userC,
      SEED_IDS.userCConsent,
      "seed.user.c@example.test",
      "seed_user_c",
      "Seed User C",
    ],
  ] as const) {
    await client.user.create({
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
            id: consentId,
            termsVersion: "2026-01-01",
            privacyVersion: "2026-01-01",
            acceptedAt: NOW,
            createdAt: NOW,
          },
        },
      },
    });
  }

  await client.connection.create({
    data: {
      id: SEED_IDS.couple,
      state: ConnectionState.ACTIVE,
      requestedByUserId: SEED_IDS.userA,
      activatedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      partners: {
        create: [
          {
            id: SEED_IDS.coupleMemberA,
            userId: SEED_IDS.userA,
            state: CouplePartnerState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: SEED_IDS.coupleMemberB,
            userId: SEED_IDS.userB,
            state: CouplePartnerState.ACTIVE,
            joinedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
      conversation: {
        create: {
          id: SEED_IDS.coupleConversation,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    },
  });
}

seedDatabase()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
