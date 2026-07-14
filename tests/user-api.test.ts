import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { userService } from "../src/modules/users/user.service.js";

const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";
const safeUser = {
  id: 2,
  fullName: "Staff User",
  email: "staff@example.com",
  phone: null,
  role: "TECHNICIAN" as const,
  status: "ACTIVE" as const,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("users API", () => {
  it("allows admins to list safe users with pagination metadata", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId,
    });
    vi.spyOn(userService, "list").mockResolvedValue({ users: [safeUser], total: 1 });

    const response = await request(app)
      .get(`${env.API_PREFIX}/users?page=1&limit=20`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(response.body.data[0]).not.toHaveProperty("password_hash");
    expect(response.body.data[0]).not.toHaveProperty("passwordHash");
  });

  it("rejects non-admin user listing", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const list = vi.spyOn(userService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/users`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(list).not.toHaveBeenCalled();
  });

  it("allows an authenticated user to reach the service-level self-update check", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "staff@example.com",
      role: "TECHNICIAN",
      sessionId,
    });
    const update = vi.spyOn(userService, "update").mockResolvedValue({
      ...safeUser,
      fullName: "Updated Staff",
    });

    const response = await request(app)
      .patch(`${env.API_PREFIX}/users/2`)
      .set("Authorization", "Bearer staff-token")
      .send({ fullName: "Updated Staff" });

    expect(response.status).toBe(200);
    expect(response.body.data.fullName).toBe("Updated Staff");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "TECHNICIAN" }),
      2,
      { fullName: "Updated Staff" },
      expect.any(Object),
    );
  });
});
