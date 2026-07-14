import rateLimit from "express-rate-limit";
import type { ApiErrorResponse } from "../common/types/api-response.js";
import { env } from "../config/env.js";

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler(_request, response) {
    const payload: ApiErrorResponse = {
      success: false,
      message: "Too many login attempts. Please try again later.",
      error: {
        code: "TOO_MANY_LOGIN_ATTEMPTS",
        details: null,
      },
    };

    response.status(429).json(payload);
  },
});
