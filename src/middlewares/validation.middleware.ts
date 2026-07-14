import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export interface RequestValidationTarget {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}

export function validate(schema: ZodType<RequestValidationTarget>): RequestHandler {
  return (request, _response, next): void => {
    try {
      request.validated = schema.parse({
        body: request.body,
        params: request.params,
        query: request.query,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
