import { createHmac, timingSafeEqual } from "node:crypto";

export type MediaAction = "GET" | "PUT";

export function signMediaAccess(
  secret: string,
  action: MediaAction,
  objectKey: string,
  expiresAtSec: number,
): string {
  return createHmac("sha256", secret)
    .update(`${action}\n${objectKey}\n${expiresAtSec}`)
    .digest("hex");
}

export function verifyMediaAccess(
  secret: string,
  action: MediaAction,
  objectKey: string,
  expiresAtSec: number,
  signature: string,
): boolean {
  if (!Number.isInteger(expiresAtSec) || expiresAtSec < 1) {
    return false;
  }
  if (expiresAtSec < Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  const expected = signMediaAccess(secret, action, objectKey, expiresAtSec);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
