import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { UnauthorizedError } from "../src/common/errors/unauthorized-error.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authentication API", () => {
  it("returns an access token and stores refresh token only in an HttpOnly cookie", async () => {
    vi.spyOn(authService, "login").mockResolvedValue({
      data: {
        user: {
          id: 1,
          fullName: "Admin",
          email: "admin@example.com",
          phone: null,
          role: "ADMIN",
          status: "ACTIVE",
          avatarUrl: null,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accessToken: "access-token",
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      },
      refreshToken: "refresh-token-must-not-be-json",
      refreshTokenExpiresAt: new Date(Date.now() + 3_600_000),
    });

    const response = await request(app).post(`${env.API_PREFIX}/auth/login`).send({
      email: "admin@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe("access-token");
    expect(JSON.stringify(response.body)).not.toContain("refresh-token-must-not-be-json");
    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain(`${env.REFRESH_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Path=${env.API_PREFIX}/auth`);
  });

  it("rejects role injection during registration before calling the service", async () => {
    const register = vi.spyOn(authService, "register");
    const response = await request(app).post(`${env.API_PREFIX}/auth/register`).send({
      fullName: "Customer User",
      email: "customer@example.com",
      password: "Password123",
      role: "ADMIN",
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(register).not.toHaveBeenCalled();
  });

  it("never accepts a refresh token from the JSON body", async () => {
    const refresh = vi.spyOn(authService, "refresh");
    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/refresh-token`)
      .send({ refreshToken: "body-token" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_TOKEN_MISSING");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rate-limits repeated failed login attempts with the common error envelope", async () => {
    vi.spyOn(authService, "login").mockRejectedValue(
      new UnauthorizedError("Invalid email or password", "AUTH_INVALID_CREDENTIALS"),
    );

    let finalStatus: number | undefined;
    let finalCode: string | undefined;

    for (let attempt = 0; attempt <= env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      const response = await request(app).post(`${env.API_PREFIX}/auth/login`).send({
        email: "rate-limit@example.com",
        password: "WrongPassword123",
      });
      finalStatus = response.status;
      finalCode = (response.body as { error?: { code?: string } }).error?.code;
    }

    expect(finalStatus).toBe(429);
    expect(finalCode).toBe("TOO_MANY_LOGIN_ATTEMPTS");
  });
});
