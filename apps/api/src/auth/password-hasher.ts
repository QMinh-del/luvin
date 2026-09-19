import argon2 from "argon2";
import {
  ARGON2_ITERATIONS,
  ARGON2_MEMORY_KIB,
  ARGON2_PARALLELISM,
  ARGON2_SALT_BYTES,
  ARGON2_TAG_BYTES,
  assertPasswordPolicy,
  isAtLeastLockedArgon2id,
} from "./password-policy";

let inFlight = 0;
const MAX_CONCURRENT = 2;
const waiters: Array<() => void> = [];

async function withHashSlot<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    const next = waiters.shift();
    next?.();
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const phc = await withHashSlot(() =>
    argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_KIB,
      timeCost: ARGON2_ITERATIONS,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_TAG_BYTES,
    }),
  );
  if (!isAtLeastLockedArgon2id(phc)) {
    throw new Error("PASSWORD_HASH_POLICY_VIOLATION");
  }
  return phc;
}

let dummyPhc: string | undefined;

async function dummyPhcString(): Promise<string> {
  dummyPhc ??= await argon2.hash("not-a-real-user-password", {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_KIB,
    timeCost: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_TAG_BYTES,
    salt: Buffer.alloc(ARGON2_SALT_BYTES, 7),
  });
  return dummyPhc;
}

export async function dummyVerifyPassword(password: string): Promise<void> {
  const phc = await dummyPhcString();
  await withHashSlot(() => argon2.verify(phc, password));
}

export async function verifyPassword(
  password: string,
  storedPhc: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const ok = await withHashSlot(() => argon2.verify(storedPhc, password));
  return { ok, needsRehash: ok && !isAtLeastLockedArgon2id(storedPhc) };
}
