import type { RequestHandler } from "express";
import type { UserRole } from "../common/constants/roles.js";
import { ForbiddenError } from "../common/errors/forbidden-error.js";
import { UnauthorizedError } from "../common/errors/unauthorized-error.js";

export function authorize(...roles: UserRole[]): RequestHandler {
  const allowedRoles = new Set(roles);

  return (request, _response, next): void => {
    if (!request.user) {
      next(new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING"));
      return;
    }

    if (!allowedRoles.has(request.user.role)) {
      next(new ForbiddenError("You are not allowed to perform this action", "FORBIDDEN"));
      return;
    }

    next();
  };
}
