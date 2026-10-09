const FUTURE_SKEW_MS = 2 * 60 * 1000;
const PUBLISH_MAX_AGE_MS = 10 * 60 * 1000;
const VISIBLE_MAX_AGE_MS = 15 * 60 * 1000;

export type LocationPublishDecision =
  | "ok"
  | "blocked"
  | "hidden"
  | "paused"
  | "replay"
  | "stale";

export function grantTargetAllowed(input: {
  actorUserId: string;
  viewerUserId: string;
  partnerUserId: string;
}): "ok" | "self" | "not-partner" {
  if (input.viewerUserId === input.actorUserId) {
    return "self";
  }
  if (input.viewerUserId !== input.partnerUserId) {
    return "not-partner";
  }
  return "ok";
}

export function locationPublishAllowed(input: {
  mode: string;
  granted: boolean;
  blocked: boolean;
  sequence: number;
  lastSequence: bigint | null;
  capturedAt: Date;
  now: Date;
}): LocationPublishDecision {
  if (input.blocked) {
    return "blocked";
  }
  if (!input.granted) {
    return "hidden";
  }
  if (input.mode !== "LIVE") {
    return "paused";
  }
  if (
    input.lastSequence !== null &&
    BigInt(input.sequence) <= input.lastSequence
  ) {
    return "replay";
  }
  const age = input.now.getTime() - input.capturedAt.getTime();
  if (age < -FUTURE_SKEW_MS || age > PUBLISH_MAX_AGE_MS) {
    return "stale";
  }
  return "ok";
}

export function locationVisible(input: {
  granted: boolean;
  blocked: boolean;
  mode: string;
  capturedAt: Date;
  now: Date;
}): boolean {
  if (!input.granted || input.blocked || input.mode !== "LIVE") {
    return false;
  }
  return input.now.getTime() - input.capturedAt.getTime() <= VISIBLE_MAX_AGE_MS;
}
