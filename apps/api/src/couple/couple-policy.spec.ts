import assert from "node:assert/strict";
import test from "node:test";
import {
  coupleRequestAllowed,
  generatePairingCode,
  hashPairingCode,
  normalizePairingCode,
  normalizeCoupleUsername,
  pairingCodeActive,
} from "./couple-policy";

test("normalizes a couple username and rejects display text", () => {
  assert.equal(normalizeCoupleUsername("  mina_1 "), "mina_1");
  assert.equal(normalizeCoupleUsername("Mina"), null);
  assert.equal(normalizeCoupleUsername("a"), null);
  assert.equal(normalizeCoupleUsername("has space"), null);
  assert.equal(normalizeCoupleUsername("mail@x"), null);
});

test("a couple request stays between two free peers", () => {
  assert.equal(
    coupleRequestAllowed({
      actorUserId: "a",
      targetUserId: "b",
      blocked: false,
      actorHasOpenCouple: false,
      targetHasOpenCouple: false,
    }),
    "ok",
  );
  assert.equal(
    coupleRequestAllowed({
      actorUserId: "a",
      targetUserId: "a",
      blocked: false,
      actorHasOpenCouple: false,
      targetHasOpenCouple: false,
    }),
    "self",
  );
  assert.equal(
    coupleRequestAllowed({
      actorUserId: "a",
      targetUserId: "b",
      blocked: true,
      actorHasOpenCouple: false,
      targetHasOpenCouple: false,
    }),
    "blocked",
  );
  assert.equal(
    coupleRequestAllowed({
      actorUserId: "a",
      targetUserId: "b",
      blocked: false,
      actorHasOpenCouple: true,
      targetHasOpenCouple: false,
    }),
    "busy",
  );
});

test("a pairing code is eight unambiguous characters and hashed", () => {
  assert.equal(normalizePairingCode(" abcd2345 "), "ABCD2345");
  assert.equal(normalizePairingCode("ABCD234O"), null);
  assert.equal(normalizePairingCode("short"), null);
  const code = generatePairingCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  assert.equal(hashPairingCode(code), hashPairingCode(code));
  assert.notEqual(hashPairingCode(code), code);
});

test("a pairing code is active only before use, revoke, and expiry", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");
  const expiresAt = new Date("2026-09-26T12:15:00.000Z");
  assert.equal(
    pairingCodeActive({
      expiresAt,
      consumedAt: null,
      revokedAt: null,
      now,
    }),
    true,
  );
  assert.equal(
    pairingCodeActive({
      expiresAt,
      consumedAt: now,
      revokedAt: null,
      now,
    }),
    false,
  );
  assert.equal(
    pairingCodeActive({
      expiresAt,
      consumedAt: null,
      revokedAt: now,
      now,
    }),
    false,
  );
  assert.equal(
    pairingCodeActive({
      expiresAt: now,
      consumedAt: null,
      revokedAt: null,
      now,
    }),
    false,
  );
});
