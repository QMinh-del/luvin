import assert from "node:assert/strict";
import test from "node:test";
import {
  PasswordPolicyError,
  assertPasswordPolicy,
  isAtLeastLockedArgon2id,
} from "./password-policy";
import { hashPassword, verifyPassword } from "./password-hasher";

test("rejects short or incomplete passwords", () => {
  assert.throws(() => assertPasswordPolicy("Ab1!short"), PasswordPolicyError);
  assert.throws(
    () => assertPasswordPolicy("alllowercase1!"),
    PasswordPolicyError,
  );
  assert.throws(
    () => assertPasswordPolicy("ALLUPPERCASE1!"),
    PasswordPolicyError,
  );
  assert.throws(
    () => assertPasswordPolicy("NoDigits!!AA"),
    PasswordPolicyError,
  );
  assert.throws(
    () => assertPasswordPolicy("NoSpecials12A"),
    PasswordPolicyError,
  );
});

test("hashes with locked Argon2id parameters and unique salts", async () => {
  const password = "StrongPassword1!";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(isAtLeastLockedArgon2id(first), true);
  const verified = await verifyPassword(password, first);
  assert.equal(verified.ok, true);
  assert.equal(verified.needsRehash, false);
  const wrong = await verifyPassword("WrongPassword1!", first);
  assert.equal(wrong.ok, false);
});

test("flags weaker stored parameters for rehash", async () => {
  assert.equal(
    isAtLeastLockedArgon2id(
      "$argon2id$v=19$m=4096,t=1,p=1$AAAAAAAAAAAAAAAAAAAAAA$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    ),
    false,
  );
});

test("verification stays under the locked 1s per-call ceiling", async () => {
  const password = "StrongPassword1!";
  const hashed = await hashPassword(password);
  const started = Date.now();
  const verified = await verifyPassword(password, hashed);
  const elapsed = Date.now() - started;
  assert.equal(verified.ok, true);
  assert.equal(elapsed < 1000, true);
});
