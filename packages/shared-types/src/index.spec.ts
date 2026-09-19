import assert from "node:assert/strict";
import test from "node:test";
import { LUVIN_CONTRACT_VERSION } from "./index.ts";
import type { ApiErrorEnvelope, HealthReadyData } from "./index.ts";

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
