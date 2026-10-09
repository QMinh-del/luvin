import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export class HostRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostRuntimeError";
  }
}

export function applyDatabaseSsl(
  databaseUrl: string,
  caFilePath: string | undefined,
): string {
  if (!caFilePath) {
    return databaseUrl;
  }
  let next = databaseUrl;
  if (!/[?&]sslmode=/.test(next)) {
    next += `${next.includes("?") ? "&" : "?"}sslmode=verify-full`;
  }
  if (!/[?&]sslrootcert=/.test(next)) {
    next += `&sslrootcert=${encodeURIComponent(caFilePath)}`;
  }
  return next;
}

export function materializeCaFile(
  label: "database" | "redis",
  value: string | undefined,
): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }
  if (!raw.includes("BEGIN CERTIFICATE")) {
    if (!existsSync(raw)) {
      throw new HostRuntimeError(`${label} CA file is not readable`);
    }
    return raw;
  }
  const file = path.join(tmpdir(), `luvin-${label}-ca.pem`);
  writeFileSync(file, raw.endsWith("\n") ? raw : `${raw}\n`, { mode: 0o600 });
  return file;
}

export function readCaPem(value: string | undefined): string | undefined {
  const file = materializeCaFile("redis", value);
  if (!file) {
    return undefined;
  }
  return readFileSync(file, "utf8");
}
