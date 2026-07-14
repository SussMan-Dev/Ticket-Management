import { randomUUID } from "node:crypto";
import jwt, {
  type JwtPayload,
  type SignOptions,
  JsonWebTokenError,
  TokenExpiredError,
} from "jsonwebtoken";
import { z } from "zod";
import { USER_ROLES } from "../constants/roles.js";
import { getJwtConfiguration } from "../../config/jwt.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  SignedToken,
} from "../../modules/auth/auth.model.js";

const accessTokenPayloadSchema = z.object({
  sub: z.coerce.number().int().positive(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  sessionId: z.string().uuid(),
});

const refreshTokenPayloadSchema = z.object({
  sub: z.coerce.number().int().positive(),
  sessionId: z.string().uuid(),
  type: z.literal("refresh"),
});

function expirationDate(token: string): Date {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new JsonWebTokenError("Signed token does not contain an expiration");
  }

  return new Date(decoded.exp * 1_000);
}

function signOptions(expiresIn: string): SignOptions {
  const config = getJwtConfiguration();

  return {
    algorithm: "HS256",
    expiresIn: expiresIn as SignOptions["expiresIn"],
    issuer: config.issuer,
    audience: config.audience,
  };
}

function verifyOptions(): jwt.VerifyOptions {
  const config = getJwtConfiguration();

  return {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.audience,
  };
}

export function signAccessToken(payload: AccessTokenPayload): SignedToken {
  const config = getJwtConfiguration();
  const token = jwt.sign(payload, config.accessSecret, signOptions(config.accessExpiresIn));

  return { token, expiresAt: expirationDate(token) };
}

export function signRefreshToken(payload: RefreshTokenPayload): SignedToken {
  const config = getJwtConfiguration();
  const token = jwt.sign(payload, config.refreshSecret, {
    ...signOptions(config.refreshExpiresIn),
    jwtid: randomUUID(),
  });

  return { token, expiresAt: expirationDate(token) };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getJwtConfiguration();
  const decoded = jwt.verify(token, config.accessSecret, verifyOptions()) as JwtPayload;
  return accessTokenPayloadSchema.parse(decoded);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const config = getJwtConfiguration();
  const decoded = jwt.verify(token, config.refreshSecret, verifyOptions()) as JwtPayload;
  return refreshTokenPayloadSchema.parse(decoded);
}

export { JsonWebTokenError, TokenExpiredError };
