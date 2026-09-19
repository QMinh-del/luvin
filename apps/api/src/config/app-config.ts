import {
  readLocalServicesConfig,
  type LocalServicesConfig,
} from "../infra/local-services-config";

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
      apiKeyPresent: true;
      from: string;
    }
  | {
      mode: "production";
      apiKeyPresent: true;
      from: string;
      domainVerified: true;
    };

export type AppConfig = {
  luvinEnv: LuvinEnv;
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  googleCloudProject: string | undefined;
  passwordRecoveryEnabled: boolean;
  resend: ResendRuntimeConfig;
  localServices: LocalServicesConfig | undefined;
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

function parsePort(raw: string | undefined): number {
  const port = Number.parseInt(raw ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigValidationError(
      "PORT must be an integer between 1 and 65535",
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
    return { mode: "sandbox", apiKeyPresent: true, from: sandboxFrom };
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
      apiKeyPresent: true,
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

  if (
    (luvinEnv === "staging" || luvinEnv === "production") &&
    !googleCloudProject
  ) {
    throw new ConfigValidationError(
      "GOOGLE_CLOUD_PROJECT is required in staging and production",
    );
  }

  const resend = readResendConfig(env, luvinEnv, passwordRecoveryEnabled);

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
      port: parsePort(env.PORT),
      databaseUrl: localServices.databaseUrl,
      redisUrl: localServices.redisUrl,
      googleCloudProject,
      passwordRecoveryEnabled,
      resend,
      localServices,
    };
  }

  return {
    luvinEnv,
    nodeEnv: env.NODE_ENV?.trim() || "development",
    port: parsePort(env.PORT),
    databaseUrl: required(env, "DATABASE_URL"),
    redisUrl: required(env, "REDIS_URL"),
    googleCloudProject,
    passwordRecoveryEnabled,
    resend,
    localServices: undefined,
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
  };
}
