export const LUVIN_CONTRACT_VERSION = "0.0.0";

export type ApiSuccessEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
  };
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    fields: Record<string, string>;
    requestId: string;
  };
};

export type HealthLiveData = {
  status: "live";
};

export type HealthCheckState = "up" | "down" | "skipped";

export type HealthReadyData = {
  status: "ready" | "not_ready";
  checks: {
    postgres: HealthCheckState;
    redis: HealthCheckState;
    objectStorage: HealthCheckState;
  };
};

export type AuthSessionData = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
  accountState: string;
  requiredLegalActions: Array<"ACCEPT_TERMS" | "ACCEPT_PRIVACY">;
};
