import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  grantTargetAllowed,
  locationPublishAllowed,
  locationVisible,
} from "./location-policy";

const now = new Date("2026-09-24T00:00:00.000Z");

describe("location policy", () => {
  it("allows a grant only to the other partner", () => {
    assert.equal(
      grantTargetAllowed({
        actorUserId: "a",
        viewerUserId: "b",
        partnerUserId: "b",
      }),
      "ok",
    );
    assert.equal(
      grantTargetAllowed({
        actorUserId: "a",
        viewerUserId: "a",
        partnerUserId: "b",
      }),
      "self",
    );
    assert.equal(
      grantTargetAllowed({
        actorUserId: "a",
        viewerUserId: "c",
        partnerUserId: "b",
      }),
      "not-partner",
    );
  });

  it("stores a live point only after a grant and a newer sequence", () => {
    assert.equal(
      locationPublishAllowed({
        mode: "LIVE",
        granted: true,
        blocked: false,
        sequence: 2,
        lastSequence: 1n,
        capturedAt: now,
        now,
      }),
      "ok",
    );
    assert.equal(
      locationPublishAllowed({
        mode: "PAUSED",
        granted: true,
        blocked: false,
        sequence: 2,
        lastSequence: 1n,
        capturedAt: now,
        now,
      }),
      "paused",
    );
    assert.equal(
      locationPublishAllowed({
        mode: "LIVE",
        granted: false,
        blocked: false,
        sequence: 2,
        lastSequence: null,
        capturedAt: now,
        now,
      }),
      "hidden",
    );
    assert.equal(
      locationPublishAllowed({
        mode: "LIVE",
        granted: true,
        blocked: false,
        sequence: 2,
        lastSequence: 2n,
        capturedAt: now,
        now,
      }),
      "replay",
    );
  });

  it("hides coordinates unless the partner granted live sharing", () => {
    assert.equal(
      locationVisible({
        granted: true,
        blocked: false,
        mode: "LIVE",
        capturedAt: now,
        now,
      }),
      true,
    );
    assert.equal(
      locationVisible({
        granted: false,
        blocked: false,
        mode: "LIVE",
        capturedAt: now,
        now,
      }),
      false,
    );
    assert.equal(
      locationVisible({
        granted: true,
        blocked: false,
        mode: "PAUSED",
        capturedAt: now,
        now,
      }),
      false,
    );
    assert.equal(
      locationVisible({
        granted: true,
        blocked: false,
        mode: "GHOST",
        capturedAt: now,
        now,
      }),
      false,
    );
    assert.equal(
      locationPublishAllowed({
        mode: "GHOST",
        granted: true,
        blocked: false,
        sequence: 2,
        lastSequence: 1n,
        capturedAt: now,
        now,
      }),
      "paused",
    );
  });
});
