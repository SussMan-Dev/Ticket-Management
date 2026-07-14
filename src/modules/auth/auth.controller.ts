import type { CookieOptions, Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import { env } from "../../config/env.js";
import type { IssuedAuthentication, RequestMetadata } from "./auth.dto.js";
import type { LoginBody, RegisterBody } from "./auth.schema.js";
import { authService } from "./auth.service.js";

function requestMetadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: `${env.API_PREFIX}/auth`,
  };
}

function setRefreshCookie(response: Response, authentication: IssuedAuthentication): void {
  response.cookie(env.REFRESH_COOKIE_NAME, authentication.refreshToken, {
    ...refreshCookieOptions(),
    expires: authentication.refreshTokenExpiresAt,
  });
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
}

export const authController = {
  async register(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as RegisterBody;
    const user = await authService.register(body, requestMetadata(request));
    return sendSuccess(response, {
      statusCode: 201,
      message: "Customer registered successfully",
      data: user,
    });
  },

  async login(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as LoginBody;
    const authentication = await authService.login(body, requestMetadata(request));
    setRefreshCookie(response, authentication);
    return sendSuccess(response, {
      message: "Login successful",
      data: authentication.data,
    });
  },

  async refresh(request: Request, response: Response): Promise<Response> {
    const refreshToken = request.cookies?.[env.REFRESH_COOKIE_NAME] as unknown;

    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      throw new UnauthorizedError("Refresh token is required", "AUTH_TOKEN_MISSING");
    }

    const authentication = await authService.refresh(
      refreshToken,
      requestMetadata(request),
    );
    setRefreshCookie(response, authentication);
    return sendSuccess(response, {
      message: "Token refreshed successfully",
      data: authentication.data,
    });
  },

  async logout(request: Request, response: Response): Promise<Response> {
    if (!request.user) {
      throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
    }

    await authService.logout(request.user, requestMetadata(request));
    clearRefreshCookie(response);
    return sendSuccess(response, {
      message: "Logout successful",
      data: null,
    });
  },

  async logoutAll(request: Request, response: Response): Promise<Response> {
    if (!request.user) {
      throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
    }

    const revokedSessions = await authService.logoutAll(
      request.user,
      requestMetadata(request),
    );
    clearRefreshCookie(response);
    return sendSuccess(response, {
      message: "All sessions logged out successfully",
      data: { revokedSessions },
    });
  },

  async me(request: Request, response: Response): Promise<Response> {
    if (!request.user) {
      throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
    }

    const user = await authService.getMe(request.user.id);
    return sendSuccess(response, {
      message: "Current user retrieved successfully",
      data: user,
    });
  },
};
