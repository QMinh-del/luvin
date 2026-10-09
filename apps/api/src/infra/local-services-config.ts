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

const LOCAL_SERVICE_TARGETS = {
  local: {
    database: "luvin_local",
    databasePort: "5432",
    redisPort: "6379",
    minioPort: 9000,
  },
  test: {
    database: "luvin_test",
    databasePort: "5433",
    redisPort: "6380",
    minioPort: 9100,
  },
} as const;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

export function parseMinioEndpoint(raw: string): {
  endPoint: string;
  port: number;
  useSSL: boolean;
} {
  const withProtocol = raw.includes("://") ? raw : `http://${raw}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MINIO_ENDPOINT must use http or https");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "MINIO_ENDPOINT must not include credentials, a path, query, or fragment",
    );
  }
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
  const target = LOCAL_SERVICE_TARGETS[luvinEnvRaw];
  const databaseUrl = required(env, "DATABASE_URL");
  const redisUrl = required(env, "REDIS_URL");
  const minio = parseMinioEndpoint(required(env, "MINIO_ENDPOINT"));
  const database = new URL(databaseUrl);
  const redis = new URL(redisUrl);

  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !LOOPBACK_HOSTS.has(database.hostname) ||
    (database.port || "5432") !== target.databasePort ||
    database.pathname !== `/${target.database}` ||
    redis.protocol !== "redis:" ||
    !LOOPBACK_HOSTS.has(redis.hostname) ||
    (redis.port || "6379") !== target.redisPort ||
    !LOOPBACK_HOSTS.has(minio.endPoint) ||
    minio.port !== target.minioPort
  ) {
    throw new Error(
      `Local service URLs must match the isolated ${luvinEnvRaw} environment`,
    );
  }
  const avatarBucket = env.MINIO_AVATAR_BUCKET?.trim() || defaults.avatar;
  const exportBucket = env.MINIO_EXPORT_BUCKET?.trim() || defaults.export;

  if (avatarBucket !== defaults.avatar || exportBucket !== defaults.export) {
    throw new Error(
      `MinIO bucket names must match the isolated ${luvinEnvRaw} environment`,
    );
  }

  return {
    luvinEnv: luvinEnvRaw,
    databaseUrl,
    redisUrl,
    minioEndPoint: minio.endPoint,
    minioPort: minio.port,
    minioUseSSL: minio.useSSL,
    minioAccessKey: required(env, "MINIO_ACCESS_KEY"),
    minioSecretKey: required(env, "MINIO_SECRET_KEY"),
    avatarBucket,
    exportBucket,
  };
}
