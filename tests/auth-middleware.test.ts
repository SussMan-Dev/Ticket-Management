import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../src/common/errors/unauthorized-error.js";
import { authenticate } from "../src/middlewares/authentication.middleware.js";
import { authorize } from "../src/middlewares/authorization.middleware.js";
import { errorHandlerMiddleware } from "../src/middlewares/error-handler.middleware.js";
import { authService } from "../src/modules/auth/auth.service.js";

function middlewareApp() {
  const app = express();
  app.get("/authenticated", authenticate, (req, res) => res.json(req.user));
  app.get(
    "/admin",
    (req, _res, next) => {
      req.user = {
        id: 1,
        email: "user@example.com",
        role: req.get("x-test-role") === "ADMIN" ? "ADMIN" : "CUSTOMER",
        sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
      };
      next();
    },
    authorize("ADMIN"),
    (_req, res) => res.json({ allowed: true }),
  );
  app.use(errorHandlerMiddleware);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authentication and authorization middleware", () => {
  it("rejects a missing bearer token", async () => {
    const response = await request(middlewareApp()).get("/authenticated");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("loads a database-validated user context", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
    });

    const response = await request(middlewareApp())
      .get("/authenticated")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("ADMIN");
  });

  it("forwards revoked-session failures", async () => {
    vi.spyOn(authService, "authenticate").mockRejectedValue(
      new UnauthorizedError("Session has been revoked", "AUTH_SESSION_REVOKED"),
    );

    const response = await request(middlewareApp())
      .get("/authenticated")
      .set("Authorization", "Bearer revoked-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_SESSION_REVOKED");
  });

  it("allows a matching role and rejects a non-matching role", async () => {
    const allowed = await request(middlewareApp()).get("/admin").set("X-Test-Role", "ADMIN");
    const forbidden = await request(middlewareApp()).get("/admin");

    expect(allowed.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });
});
