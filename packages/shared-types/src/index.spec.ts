import assert from "node:assert/strict";
import test from "node:test";
import { LUVIN_CONTRACT_VERSION } from "./index.ts";

test("exports a contract version string", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});
