import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeObjectKey,
  containsForbiddenObjectIdentity,
  createObjectKey,
} from "./object-key";

test("creates non-guessable keys without email, username, or filename", () => {
  const avatar = createObjectKey("avatar");
  const exported = createObjectKey("export");
  assert.match(avatar, /^a\/[0-9a-f-]{36}$/i);
  assert.match(exported, /^e\/[0-9a-f-]{36}$/i);
  assert.equal(containsForbiddenObjectIdentity(avatar), false);
  assert.equal(containsForbiddenObjectIdentity(exported), false);
  assert.notEqual(avatar, exported);
});

test("rejects object keys that look like identities or filenames", () => {
  assert.equal(containsForbiddenObjectIdentity("user@example.com/a.png"), true);
  assert.equal(containsForbiddenObjectIdentity("avatar.jpg"), true);
  assert.throws(() => assertSafeObjectKey("users/alice/photo.png"));
  assert.throws(() => assertSafeObjectKey("a/not-a-uuid"));
});
