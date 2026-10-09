import { createHash, randomInt } from "node:crypto";

const USERNAME = /^[a-z0-9_]{3,20}$/;
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

export function normalizeCoupleUsername(value: string): string | null {
  const username = value.trim();
  return USERNAME.test(username) ? username : null;
}

export function coupleRequestAllowed(input: {
  actorUserId: string;
  targetUserId: string;
  blocked: boolean;
  actorHasOpenCouple: boolean;
  targetHasOpenCouple: boolean;
}): "ok" | "self" | "blocked" | "busy" {
  if (input.actorUserId === input.targetUserId) {
    return "self";
  }
  if (input.blocked) {
    return "blocked";
  }
  if (input.actorHasOpenCouple || input.targetHasOpenCouple) {
    return "busy";
  }
  return "ok";
}

export function normalizePairingCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return PAIRING_CODE.test(code) ? code : null;
}

export function hashPairingCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generatePairingCode(): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return code;
}

export function pairingCodeActive(input: {
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  now: Date;
}): boolean {
  return (
    input.consumedAt === null &&
    input.revokedAt === null &&
    input.expiresAt.getTime() > input.now.getTime()
  );
}
