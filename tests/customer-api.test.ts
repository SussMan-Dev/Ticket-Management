import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { customerService } from "../src/modules/customers/customer.service.js";

const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";
const summary = {
  id: 2,
  fullName: "Customer User",
  email: "customer@example.com",
  phone: null,
  status: "ACTIVE" as const,
  createdAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("customers API", () => {
  it("allows receptionists to search customers with pagination", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "receptionist@example.com",
      role: "RECEPTIONIST",
      sessionId,
    });
    vi.spyOn(customerService, "list").mockResolvedValue({
      customers: [summary],
      total: 1,
    });

    const response = await request(app)
      .get(`${env.API_PREFIX}/customers?search=customer&page=1&limit=20`)
      .set("Authorization", "Bearer staff-token");

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(response.body.data[0]).not.toHaveProperty("notes");
  });

  it("rejects customer access to the staff search endpoint", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const list = vi.spyOn(customerService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/customers`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("routes an own-profile request through the service ownership check", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const getById = vi.spyOn(customerService, "getById").mockResolvedValue({
      ...summary,
      avatarUrl: null,
      address: "Bangkok",
      updatedAt: new Date(),
    });

    const response = await request(app)
      .get(`${env.API_PREFIX}/customers/2`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(getById).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 2);
  });

  it("validates staff-created customer credentials", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "manager@example.com",
      role: "MANAGER",
      sessionId,
    });
    const create = vi.spyOn(customerService, "create");

    const response = await request(app)
      .post(`${env.API_PREFIX}/customers`)
      .set("Authorization", "Bearer manager-token")
      .send({
        fullName: "Customer User",
        email: "customer@example.com",
        password: "weak",
      });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });
});
