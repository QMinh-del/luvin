export const ARGON2_TYPE = "argon2id";
export const ARGON2_VERSION = 0x13;
export const ARGON2_MEMORY_KIB = 19456;
export const ARGON2_ITERATIONS = 2;
export const ARGON2_PARALLELISM = 1;
export const ARGON2_SALT_BYTES = 16;
export const ARGON2_TAG_BYTES = 32;

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SPECIAL = /[^A-Za-z0-9]/;

export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 10) {
    throw new PasswordPolicyError("PASSWORD_TOO_SHORT");
  }
  if (
    !UPPER.test(password) ||
    !LOWER.test(password) ||
    !DIGIT.test(password) ||
    !SPECIAL.test(password)
  ) {
    throw new PasswordPolicyError("PASSWORD_CATEGORY_MISSING");
  }
}

const PHC =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

export function isAtLeastLockedArgon2id(phc: string): boolean {
  const match = PHC.exec(phc);
  if (!match) {
    return false;
  }
  const memory = Number.parseInt(match[1], 10);
  const iterations = Number.parseInt(match[2], 10);
  const parallelism = Number.parseInt(match[3], 10);
  const salt = Buffer.from(match[4], "base64");
  const tag = Buffer.from(match[5], "base64");
  return (
    memory >= ARGON2_MEMORY_KIB &&
    iterations >= ARGON2_ITERATIONS &&
    parallelism >= ARGON2_PARALLELISM &&
    salt.length === ARGON2_SALT_BYTES &&
    tag.length === ARGON2_TAG_BYTES
  );
}
