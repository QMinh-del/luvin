import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/app-config.token";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AccessClaims = {
  sub: string;
  sid: string;
  did: string;
};

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async signAccessToken(claims: AccessClaims): Promise<string> {
    return jwt.sign(
      { sid: claims.sid, did: claims.did },
      this.config.accessTokenSecret,
      {
        algorithm: "HS256",
        subject: claims.sub,
        expiresIn: ACCESS_TTL_SEC,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    const payload = jwt.verify(token, this.config.accessTokenSecret, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.did !== "string"
    ) {
      throw new Error("ACCESS_TOKEN_INVALID");
    }
    return { sub: payload.sub, sid: payload.sid, did: payload.did };
  }

  issueRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(32).toString("base64url");
    return {
      raw,
      hash: hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    };
  }
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
