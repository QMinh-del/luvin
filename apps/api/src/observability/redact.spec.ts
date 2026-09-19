import assert from "node:assert/strict";
import test from "node:test";
import { redactValue } from "./redact";

test("redacts credentials, coordinates, message text, and date of birth", () => {
  const redacted = redactValue({
    password: "SuperSecret1!",
    token: "access-token",
    dateOfBirth: "2000-01-31",
    latitude: 10.77,
    longitude: 106.7,
    message: "private chat text",
    databaseUrl: "postgresql://luvin:luvin@127.0.0.1:5432/luvin_local",
    nested: {
      authorization: "Bearer abc",
      safe: "ok",
    },
  }) as Record<string, unknown>;

  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.dateOfBirth, "[REDACTED]");
  assert.equal(redacted.latitude, "[REDACTED]");
  assert.equal(redacted.longitude, "[REDACTED]");
  assert.equal(redacted.message, "[REDACTED]");
  assert.equal(redacted.databaseUrl, "[REDACTED]");
  assert.equal(
    (redacted.nested as Record<string, unknown>).authorization,
    "[REDACTED]",
  );
  assert.equal((redacted.nested as Record<string, unknown>).safe, "ok");
});

test("redacts credentials embedded in connection strings", () => {
  const redacted = redactValue("redis://user:secret@127.0.0.1:6379");
  assert.equal(redacted, "redis://[REDACTED]@127.0.0.1:6379");
});
