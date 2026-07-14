import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../common/errors/app-error.js";
import type { ApiErrorResponse } from "../common/types/api-response.js";
import { logger } from "../common/utils/logger.js";
import { env } from "../config/env.js";

function zodDetails(error: ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
): void => {
  if (error instanceof ZodError) {
    const payload: ApiErrorResponse = {
      success: false,
      message: "Request validation failed",
      error: {
        code: "VALIDATION_ERROR",
        details: zodDetails(error),
      },
    };

    response.status(422).json(payload);
    return;
  }

  const transportError = error as { status?: unknown; type?: unknown };

  if (error instanceof SyntaxError && transportError.status === 400) {
    const payload: ApiErrorResponse = {
      success: false,
      message: "Request body contains invalid JSON",
      error: {
        code: "INVALID_JSON",
        details: null,
      },
    };

    response.status(400).json(payload);
    return;
  }

  if (transportError.status === 413) {
    const payload: ApiErrorResponse = {
      success: false,
      message: "Request body is too large",
      error: {
        code: "PAYLOAD_TOO_LARGE",
        details: null,
      },
    };

    response.status(413).json(payload);
    return;
  }

  if (error instanceof AppError) {
    if (!error.isOperational) {
      logger.error("Non-operational application error", {
        code: error.code,
        message: error.message,
        method: request.method,
        path: request.path,
        stack: error.stack,
      });
    }

    const payload: ApiErrorResponse = {
      success: false,
      message: error.message,
      error: {
        code: error.code,
        details: error.details,
      },
    };

    response.status(error.statusCode).json(payload);
    return;
  }

  logger.error("Unhandled request error", {
    message: error instanceof Error ? error.message : "Unknown error",
    method: request.method,
    path: request.path,
    stack: error instanceof Error ? error.stack : undefined,
  });

  const payload: ApiErrorResponse = {
    success: false,
    message:
      env.NODE_ENV === "production" && error instanceof Error
        ? "An unexpected error occurred"
        : error instanceof Error
          ? error.message
          : "An unexpected error occurred",
    error: {
      code: "INTERNAL_SERVER_ERROR",
      details: null,
    },
  };

  response.status(500).json(payload);
};
