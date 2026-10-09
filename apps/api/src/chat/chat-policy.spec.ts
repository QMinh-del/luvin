import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMessageBody } from "./chat-policy";

describe("chat policy", () => {
  it("trims a message and rejects an empty body", () => {
    assert.equal(normalizeMessageBody("  hello  "), "hello");
    assert.equal(normalizeMessageBody("   "), null);
  });

  it("rejects a body longer than 4000 characters", () => {
    assert.equal(normalizeMessageBody("a".repeat(4001)), null);
    assert.equal(normalizeMessageBody("a".repeat(4000))?.length, 4000);
  });
});
