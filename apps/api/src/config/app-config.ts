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
  captchaAfter: number;
};

export type AuthRateLimitsConfig = {
  windowSec: number;
  register: AuthRateLimitPolicy;
  login: AuthRateLimitPolicy;
  refresh: AuthRateLimitPolicy;
  password_reset: AuthRateLimitPolicy;
  email_change: AuthRateLimitPolicy;
};

export type TurnstileRuntimeConfig =
  | { mode: "local" }
  | { mode: "cloudflare"; secret: string };

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
  accessTokenSecret: string;
  authRateLimits: AuthRateLimitsConfig;
  turnstile: TurnstileRuntimeConfig;
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

  if (
    (luvinEnv === "staging" || luvinEnv === "production") &&
    !googleCloudProject
  ) {
    throw new ConfigValidationError(
      "GOOGLE_CLOUD_PROJECT is required in staging and production",
    );
  }

  const resend = readResendConfig(env, luvinEnv, passwordRecoveryEnabled);
  const accessTokenSecret = required(env, "ACCESS_TOKEN_SECRET");
  if (accessTokenSecret.length < 32) {
    throw new ConfigValidationError(
      "ACCESS_TOKEN_SECRET must be at least 32 characters",
    );
  }
  const authRateLimits = readAuthRateLimits(env);
  const turnstile = readTurnstileConfig(env, luvinEnv);

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
      accessTokenSecret,
      authRateLimits,
      turnstile,
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
    accessTokenSecret,
    authRateLimits,
    turnstile,
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
    turnstileMode: config.turnstile.mode,
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
    5,
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
    register: {
      max: registerMax,
      captchaAfter: parsePositiveInt(
        env.AUTH_TURNSTILE_REGISTER_AFTER,
        Math.min(3, registerMax),
        "AUTH_TURNSTILE_REGISTER_AFTER",
      ),
    },
    login: {
      max: loginMax,
      captchaAfter: parsePositiveInt(
        env.AUTH_TURNSTILE_LOGIN_AFTER,
        Math.min(5, loginMax),
        "AUTH_TURNSTILE_LOGIN_AFTER",
      ),
    },
    refresh: { max: refreshMax, captchaAfter: refreshMax + 1 },
    password_reset: {
      max: resetMax,
      captchaAfter: parsePositiveInt(
        env.AUTH_TURNSTILE_PASSWORD_RESET_AFTER,
        Math.min(3, resetMax),
        "AUTH_TURNSTILE_PASSWORD_RESET_AFTER",
      ),
    },
    email_change: { max: emailMax, captchaAfter: emailMax + 1 },
  };
}

function readTurnstileConfig(
  env: NodeJS.ProcessEnv,
  luvinEnv: LuvinEnv,
): TurnstileRuntimeConfig {
  const secret = optional(env, "TURNSTILE_SECRET_KEY");
  if (secret) {
    return { mode: "cloudflare", secret };
  }
  if (luvinEnv === "staging" || luvinEnv === "production") {
    throw new ConfigValidationError(
      "TURNSTILE_SECRET_KEY is required in staging and production",
    );
  }
  return { mode: "local" };
}
