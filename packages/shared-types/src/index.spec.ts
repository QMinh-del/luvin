import assert from "node:assert/strict";
import test from "node:test";
import { LUVIN_CONTRACT_VERSION } from "./index.ts";
import type {
  ApiErrorEnvelope,
  CoupleData,
  HealthReadyData,
  PairingCodeStatus,
} from "./index.ts";

test("exports a contract version string", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});

test("error envelope shape uses requestId inside error", () => {
  const envelope: ApiErrorEnvelope = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      fields: {},
      requestId: "req-1",
    },
  };
  assert.equal(envelope.error.requestId, "req-1");
});

test("ready payload distinguishes dependency checks", () => {
  const data: HealthReadyData = {
    status: "not_ready",
    checks: {
      postgres: "up",
      redis: "down",
      objectStorage: "skipped",
    },
  };
  assert.equal(data.status, "not_ready");
  assert.equal(data.checks.redis, "down");
});

test("pairing contracts expose status without plaintext", () => {
  const status: PairingCodeStatus = {
    active: true,
    expiresAt: "2026-09-26T16:45:00.000Z",
  };
  assert.equal("code" in status, false);

  const couple: CoupleData = {
    connectionId: "11111111-1111-4111-8111-111111111111",
    state: "PENDING",
    invitationId: "22222222-2222-4222-8222-222222222222",
    partners: [
      {
        userId: "33333333-3333-4333-8333-333333333333",
        username: "owner",
        displayName: "Owner",
        membershipState: "ACTIVE",
      },
      {
        userId: "44444444-4444-4444-8444-444444444444",
        username: "partner",
        displayName: "Partner",
        membershipState: "INVITED",
      },
    ],
  };
  assert.equal(couple.partners.length, 2);
});
