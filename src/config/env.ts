import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const tokenDuration = z
  .string()
  .trim()
  .regex(/^\d+[smhd]$/, "Token duration must use formats such as 15m or 30d");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  API_PREFIX: z
    .string()
    .trim()
    .regex(/^\/[a-zA-Z0-9/_-]*$/, "API_PREFIX must start with /")
    .default("/api/v1"),
  REQUEST_BODY_LIMIT: z.string().trim().min(1).default("1mb"),
  TRUST_PROXY: booleanFromString,
  DB_HOST: z.string().trim().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3_306),
  DB_USER: z.string().trim().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().trim().regex(/^[a-zA-Z0-9_]+$/).default("repair_ticket_system"),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  CORS_ORIGINS: z.string().trim().default("http://localhost:3000"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCK_DURATION_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(900_000),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(1_000).default(10),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: tokenDuration.default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: tokenDuration.default("30d"),
  JWT_ISSUER: z.string().trim().min(1).default("repair-ticket-system"),
  JWT_AUDIENCE: z.string().trim().min(1).default("repair-ticket-client"),
  REFRESH_COOKIE_NAME: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).default("repair_refresh_token"),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

const parsedEnvironment = result.data;

export const env = Object.freeze({
  ...parsedEnvironment,
  CORS_ORIGINS: parsedEnvironment.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});

export type Environment = typeof env;
