import type { RequestHandler } from "express";
import { UnauthorizedError } from "../common/errors/unauthorized-error.js";
import { authService } from "../modules/auth/auth.service.js";

function createAuthenticationMiddleware(allowRevokedSession: boolean): RequestHandler {
  return (request, _response, next): void => {
  const authorization = request.get("authorization");

  if (!authorization) {
    next(new UnauthorizedError("Access token is required", "AUTH_TOKEN_MISSING"));
    return;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    next(new UnauthorizedError("Access token is invalid", "AUTH_TOKEN_INVALID"));
    return;
  }

  void authService
    .authenticate(token, { allowRevokedSession })
    .then((user) => {
      request.user = user;
      next();
    })
    .catch(next);
  };
}

export const authenticate = createAuthenticationMiddleware(false);
export const authenticateForLogout = createAuthenticationMiddleware(true);
