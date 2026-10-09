import {
  parseMinioEndpoint,
  readLocalServicesConfig,
  type LocalServicesConfig,
} from "../infra/local-services-config";
import type { ObjectStorageConfig } from "../storage/object-storage.port";

export type LuvinEnv =
  | "local"
  | "test"
  | "development"
  | "staging"
  | "production";

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export type ResendRuntimeConfig =
  | {
      mode: "disabled";
    }
  | {
      mode: "sandbox";
      apiKey: string;
      from: string;
    }
  | {
      mode: "production";
      apiKey: string;
      from: string;
      domainVerified: true;
    };

export type AuthRateLimitPolicy = {
  max: number;
};

export type AuthRateLimitsConfig = {
  windowSec: number;
  register: AuthRateLimitPolicy;
  login: AuthRateLimitPolicy;
  refresh: AuthRateLimitPolicy;
  password_reset: AuthRateLimitPolicy;
  email_change: AuthRateLimitPolicy;
};

export type AppConfig = {
  luvinEnv: LuvinEnv;
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  databaseSslCa: string | undefined;
  redisUrl: string;
  redisSslCa: string | undefined;
  googleCloudProject: string | undefined;
  passwordRecoveryEnabled: boolean;
  resend: ResendRuntimeConfig;
  localServices: LocalServicesConfig | undefined;
  objectStorage: ObjectStorageConfig;
  accessTokenSecret: string;
  authRateLimits: AuthRateLimitsConfig;
};

const LUVIN_ENVS: readonly LuvinEnv[] = [
  "local",
  "test",
  "development",
  "staging",
  "production",
];

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new ConfigValidationError(`Missing ${key}`);
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new ConfigValidationError(
    "Boolean environment values must be true or false",
  );
}

function parseListenPort(env: NodeJS.ProcessEnv): number {
  const assigned = env.SERVER_PORT?.trim();
  const raw = assigned ? assigned : (env.PORT?.trim() ?? "3000");
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigValidationError(
      "SERVER_PORT or PORT must be an integer between 1 and 65535",
    );
  }
  return port;
}

function parseLuvinEnv(raw: string | undefined): LuvinEnv {
  if (!raw || !LUVIN_ENVS.includes(raw as LuvinEnv)) {
    throw new ConfigValidationError(
      "LUVIN_ENV must be local, test, development, staging, or production",
    );
  }
  return raw as LuvinEnv;
}

function readResendConfig(
  env: NodeJS.ProcessEnv,
  luvinEnv: LuvinEnv,
  passwordRecoveryEnabled: boolean,
): ResendRuntimeConfig {
  const sandboxKey = optional(env, "RESEND_SANDBOX_API_KEY");
  const productionKey = optional(env, "RESEND_PRODUCTION_API_KEY");
  const sandboxFrom =
    optional(env, "RESEND_SANDBOX_FROM") ?? "onboarding@resend.dev";
  const productionFrom = optional(env, "RESEND_PRODUCTION_FROM");
  const domainVerified = parseBoolean(
    env.RESEND_PRODUCTION_DOMAIN_VERIFIED,
    false,
  );

  if (
    luvinEnv === "local" ||
    luvinEnv === "test" ||
    luvinEnv === "development"
  ) {
    if (productionKey) {
      throw new ConfigValidationError(
        "RESEND_PRODUCTION_API_KEY must not be loaded outside staging or production",
      );
    }
    if (!passwordRecoveryEnabled) {
      return { mode: "disabled" };
    }
    if (!sandboxKey) {
      throw new ConfigValidationError(
        "RESEND_SANDBOX_API_KEY is required when password recovery is enabled",
      );
    }
    return { mode: "sandbox", apiKey: sandboxKey, from: sandboxFrom };
  }

  if (sandboxKey) {
    throw new ConfigValidationError(
      "RESEND_SANDBOX_API_KEY must not be loaded in staging or production",
    );
  }

  if (passwordRecoveryEnabled) {
    if (luvinEnv === "production" && !domainVerified) {
      throw new ConfigValidationError(
        "Production password recovery requires a verified Resend sender domain",
      );
    }
    if (!productionKey) {
      throw new ConfigValidationError(
        "RESEND_PRODUCTION_API_KEY is required when password recovery is enabled",
      );
    }
    if (!productionFrom) {
      throw new ConfigValidationError(
        "RESEND_PRODUCTION_FROM is required when password recovery is enabled",
      );
    }
    if (!domainVerified) {
      throw new ConfigValidationError(
        "RESEND_PRODUCTION_DOMAIN_VERIFIED must be true when password recovery is enabled",
      );
    }
    return {
      mode: "production",
      apiKey: productionKey,
      from: productionFrom,
      domainVerified: true,
    };
  }

  return { mode: "disabled" };
}

export function readAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const luvinEnv = parseLuvinEnv(env.LUVIN_ENV);
  const passwordRecoveryEnabled = parseBoolean(
    env.PASSWORD_RECOVERY_ENABLED,
    false,
  );
  const googleCloudProject = optional(env, "GOOGLE_CLOUD_PROJECT");
  const filesystemStorage =
    optional(env, "OBJECT_STORAGE_BACKEND") === "filesystem";
  if (
    (luvinEnv === "staging" || luvinEnv === "production") &&
    !filesystemStorage &&
    !googleCloudProject
  ) {
    throw new ConfigValidationError(
      "GOOGLE_CLOUD_PROJECT is required in staging and production",
    );
  }
  const accessTokenSecret = required(env, "ACCESS_TOKEN_SECRET");
  const objectStorage = readObjectStorageConfig(
    env,
    luvinEnv,
    googleCloudProject,
    accessTokenSecret,
  );

  const resend = readResendConfig(env, luvinEnv, passwordRecoveryEnabled);
  if (accessTokenSecret.length < 32) {
    throw new ConfigValidationError(
      "ACCESS_TOKEN_SECRET must be at least 32 characters",
    );
  }
  const authRateLimits = readAuthRateLimits(env);
  const databaseSslCa = optional(env, "DATABASE_SSL_CA");
  const redisSslCa = optional(env, "REDIS_SSL_CA");
  if (luvinEnv === "local" || luvinEnv === "test") {
    let localServices;
    try {
      localServices = readLocalServicesConfig(env);
    } catch (error) {
      throw new ConfigValidationError(
        error instanceof Error
          ? error.message
          : "Invalid local infrastructure configuration",
      );
    }
    return {
      luvinEnv,
      nodeEnv: env.NODE_ENV?.trim() || "development",
      port: parseListenPort(env),
      databaseUrl: localServices.databaseUrl,
      databaseSslCa,
      redisUrl: localServices.redisUrl,
      redisSslCa,
      googleCloudProject,
      passwordRecoveryEnabled,
      resend,
      localServices,
      objectStorage,
      accessTokenSecret,
      authRateLimits,
    };
  }

  return {
    luvinEnv,
    nodeEnv: env.NODE_ENV?.trim() || "development",
    port: parseListenPort(env),
    databaseUrl: required(env, "DATABASE_URL"),
    databaseSslCa,
    redisUrl: required(env, "REDIS_URL"),
    redisSslCa,
    googleCloudProject,
    passwordRecoveryEnabled,
    resend,
    localServices: undefined,
    objectStorage,
    accessTokenSecret,
    authRateLimits,
  };
}

export function publicAppConfig(config: AppConfig): Record<string, unknown> {
  return {
    luvinEnv: config.luvinEnv,
    nodeEnv: config.nodeEnv,
    port: config.port,
    googleCloudProject: config.googleCloudProject ?? null,
    passwordRecoveryEnabled: config.passwordRecoveryEnabled,
    resendMode: config.resend.mode,
    hasLocalServices: Boolean(config.localServices),
    objectStorageBackend: config.objectStorage.backend,
  };
}

function readObjectStorageConfig(
  env: NodeJS.ProcessEnv,
  luvinEnv: LuvinEnv,
  googleCloudProject: string | undefined,
  signingSecret: string,
): ObjectStorageConfig {
  const requested = optional(env, "OBJECT_STORAGE_BACKEND");
  if (requested === "filesystem") {
    const publicBaseUrl = required(env, "PUBLIC_BASE_URL").replace(/\/+$/, "");
    if (!/^https?:\/\//.test(publicBaseUrl)) {
      throw new ConfigValidationError(
        "PUBLIC_BASE_URL must be an absolute http(s) URL",
      );
    }
    return {
      backend: "filesystem",
      root: optional(env, "OBJECT_STORAGE_ROOT") ?? "/app/data/objects",
      publicBaseUrl,
      signingSecret,
    };
  }
  const expected =
    luvinEnv === "local" || luvinEnv === "test" || luvinEnv === "development"
      ? "minio"
      : "gcs";
  if (requested && requested !== expected) {
    throw new ConfigValidationError(
      `OBJECT_STORAGE_BACKEND must be ${expected} or filesystem`,
    );
  }

  if (luvinEnv === "local" || luvinEnv === "test") {
    let local;
    try {
      local = readLocalServicesConfig(env);
    } catch (error) {
      throw new ConfigValidationError(
        error instanceof Error
          ? error.message
          : "Invalid local object-storage configuration",
      );
    }
    return {
      backend: "minio",
      endPoint: local.minioEndPoint,
      port: local.minioPort,
      useSSL: local.minioUseSSL,
      accessKey: local.minioAccessKey,
      secretKey: local.minioSecretKey,
      avatarBucket: local.avatarBucket,
      exportBucket: local.exportBucket,
    };
  }

  if (luvinEnv === "development") {
    const minio = parseMinioEndpoint(required(env, "MINIO_ENDPOINT"));
    return {
      backend: "minio",
      endPoint: minio.endPoint,
      port: minio.port,
      useSSL: minio.useSSL,
      accessKey: required(env, "MINIO_ACCESS_KEY"),
      secretKey: required(env, "MINIO_SECRET_KEY"),
      avatarBucket: env.MINIO_AVATAR_BUCKET?.trim() || "luvin-dev-avatars",
      exportBucket: env.MINIO_EXPORT_BUCKET?.trim() || "luvin-dev-exports",
    };
  }

  if (!googleCloudProject) {
    throw new ConfigValidationError(
      "GOOGLE_CLOUD_PROJECT is required for Google Cloud Storage",
    );
  }
  return {
    backend: "gcs",
    projectId: googleCloudProject,
    avatarBucket: required(env, "GCS_AVATAR_BUCKET"),
    exportBucket: required(env, "GCS_EXPORT_BUCKET"),
  };
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new ConfigValidationError(`${label} must be a positive integer`);
  }
  return value;
}

function readAuthRateLimits(env: NodeJS.ProcessEnv): AuthRateLimitsConfig {
  const windowSec = parsePositiveInt(
    env.AUTH_RATE_LIMIT_WINDOW_SEC,
    900,
    "AUTH_RATE_LIMIT_WINDOW_SEC",
  );
  const registerMax = parsePositiveInt(
    env.AUTH_RATE_LIMIT_REGISTER_MAX,
    10,
    "AUTH_RATE_LIMIT_REGISTER_MAX",
  );
  const loginMax = parsePositiveInt(
    env.AUTH_RATE_LIMIT_LOGIN_MAX,
    10,
    "AUTH_RATE_LIMIT_LOGIN_MAX",
  );
  const refreshMax = parsePositiveInt(
    env.AUTH_RATE_LIMIT_REFRESH_MAX,
    60,
    "AUTH_RATE_LIMIT_REFRESH_MAX",
  );
  const resetMax = parsePositiveInt(
    env.AUTH_RATE_LIMIT_PASSWORD_RESET_MAX,
    5,
    "AUTH_RATE_LIMIT_PASSWORD_RESET_MAX",
  );
  const emailMax = parsePositiveInt(
    env.AUTH_RATE_LIMIT_EMAIL_CHANGE_MAX,
    5,
    "AUTH_RATE_LIMIT_EMAIL_CHANGE_MAX",
  );
  return {
    windowSec,
    register: { max: registerMax },
    login: { max: loginMax },
    refresh: { max: refreshMax },
    password_reset: { max: resetMax },
    email_change: { max: emailMax },
  };
}
