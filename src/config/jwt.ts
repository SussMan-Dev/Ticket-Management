import { env } from "./env.js";

export interface JwtConfiguration {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export function getJwtConfiguration(): JwtConfiguration {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured before authentication is enabled",
    );
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error("Access and refresh token secrets must be different");
  }

  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
}
