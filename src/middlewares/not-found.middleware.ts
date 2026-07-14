import type { RequestHandler } from "express";
import { NotFoundError } from "../common/errors/not-found-error.js";

export const notFoundMiddleware: RequestHandler = (request, _response, next): void => {
  next(
    new NotFoundError(
      `Route ${request.method} ${request.path} was not found`,
      "ROUTE_NOT_FOUND",
    ),
  );
};
