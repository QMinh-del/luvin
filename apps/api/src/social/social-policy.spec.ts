import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approvedMood, normalizeDisplayName } from "./social-policy";

describe("profile and mood policy", () => {
  it("accepts a display name and rejects a blank one", () => {
    assert.equal(normalizeDisplayName("  Nice  "), "Nice");
    assert.equal(normalizeDisplayName("   "), null);
    assert.equal(normalizeDisplayName("bad\u0000name"), null);
  });

  it("allows only the couple mood codes", () => {
    assert.equal(approvedMood("loving"), "LOVING");
    assert.equal(approvedMood("ANGRY"), null);
  });
});
