export type LocalInfraEnvName = "local" | "test";

export type LocalServicesConfig = {
  luvinEnv: LocalInfraEnvName;
  databaseUrl: string;
  redisUrl: string;
  minioEndPoint: string;
  minioPort: number;
  minioUseSSL: boolean;
  minioAccessKey: string;
  minioSecretKey: string;
  avatarBucket: string;
  exportBucket: string;
};

const LOCAL_BUCKETS = {
  local: {
    avatar: "luvin-local-avatars",
    export: "luvin-local-exports",
  },
  test: {
    avatar: "luvin-test-avatars",
    export: "luvin-test-exports",
  },
} as const;

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function parseMinioEndpoint(raw: string): {
  endPoint: string;
  port: number;
  useSSL: boolean;
} {
  const withProtocol = raw.includes("://") ? raw : `http://${raw}`;
  const url = new URL(withProtocol);
  const useSSL = url.protocol === "https:";
  const port = url.port ? Number.parseInt(url.port, 10) : useSSL ? 443 : 80;
  return {
    endPoint: url.hostname,
    port,
    useSSL,
  };
}

export function bucketsForEnv(luvinEnv: LocalInfraEnvName): {
  avatar: string;
  export: string;
} {
  return LOCAL_BUCKETS[luvinEnv];
}

export function readLocalServicesConfig(
  env: NodeJS.ProcessEnv,
): LocalServicesConfig {
  const luvinEnvRaw = env.LUVIN_ENV?.trim();
  if (luvinEnvRaw !== "local" && luvinEnvRaw !== "test") {
    throw new Error("LUVIN_ENV must be local or test for local infrastructure");
  }

  const defaults = bucketsForEnv(luvinEnvRaw);
  const minio = parseMinioEndpoint(required(env, "MINIO_ENDPOINT"));

  return {
    luvinEnv: luvinEnvRaw,
    databaseUrl: required(env, "DATABASE_URL"),
    redisUrl: required(env, "REDIS_URL"),
    minioEndPoint: minio.endPoint,
    minioPort: minio.port,
    minioUseSSL: minio.useSSL,
    minioAccessKey: required(env, "MINIO_ACCESS_KEY"),
    minioSecretKey: required(env, "MINIO_SECRET_KEY"),
    avatarBucket: env.MINIO_AVATAR_BUCKET?.trim() || defaults.avatar,
    exportBucket: env.MINIO_EXPORT_BUCKET?.trim() || defaults.export,
  };
}
