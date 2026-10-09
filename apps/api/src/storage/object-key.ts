import { randomUUID } from "node:crypto";
import type { ObjectPurpose } from "./object-storage.port";

export const OBJECT_KEY_PATTERN =
  /^[ae]\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createObjectKey(purpose: ObjectPurpose): string {
  const prefix = purpose === "avatar" ? "a" : "e";
  return `${prefix}/${randomUUID()}`;
}

export function assertSafeObjectKey(objectKey: string): void {
  if (!OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new Error("OBJECT_KEY_INVALID");
  }
}

export function containsForbiddenObjectIdentity(value: string): boolean {
  return (
    value.includes("@") ||
    value.includes(" ") ||
    /\.(jpg|jpeg|png|webp|zip)$/i.test(value)
  );
}
