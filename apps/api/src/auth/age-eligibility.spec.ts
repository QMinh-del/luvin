import assert from "node:assert/strict";
import test from "node:test";
import { isAgeEligibleOn } from "./age-eligibility";

test("rejects under 18 using Asia/Ho_Chi_Minh calendar date", () => {
  const noonIct = new Date("2026-09-19T05:00:00.000Z");
  assert.equal(isAgeEligibleOn("2008-09-19", noonIct), true);
  assert.equal(isAgeEligibleOn("2008-09-20", noonIct), false);
});

test("rejects malformed dates", () => {
  assert.equal(isAgeEligibleOn("2000/01/01", new Date()), false);
});

test("rejects impossible, future, and leap-day edge dates in Asia/Ho_Chi_Minh", () => {
  const noonIct = new Date("2026-03-01T05:00:00.000Z");
  assert.equal(isAgeEligibleOn("2008-02-29", noonIct), true);
  assert.equal(isAgeEligibleOn("2008-03-02", noonIct), false);
  assert.equal(isAgeEligibleOn("2099-01-01", noonIct), false);
  assert.equal(isAgeEligibleOn("2000-13-40", noonIct), false);
  assert.equal(isAgeEligibleOn("", noonIct), false);
});
