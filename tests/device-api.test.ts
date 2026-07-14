import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { deviceService } from "../src/modules/devices/device.service.js";

const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";
const device = {
  id: 10,
  customer: { id: 2, fullName: "Customer User" },
  category: { id: 1, name: "Phone" },
  brand: null,
  model: "Model X",
  serialNumber: null,
  imei: null,
  color: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("devices API", () => {
  it("allows customers to list devices through service ownership scoping", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const list = vi.spyOn(deviceService, "list").mockResolvedValue({
      devices: [device],
      total: 1,
    });

    const response = await request(app)
      .get(`${env.API_PREFIX}/devices?page=1&limit=20`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("exposes active category catalog before the dynamic id route", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    vi.spyOn(deviceService, "listCategories").mockResolvedValue([
      { id: 1, name: "Phone", description: null },
    ]);

    const response = await request(app)
      .get(`${env.API_PREFIX}/devices/categories`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 1, name: "Phone", description: null }]);
  });

  it("allows intake staff to create a device for a selected customer", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "receptionist@example.com",
      role: "RECEPTIONIST",
      sessionId,
    });
    const create = vi.spyOn(deviceService, "create").mockResolvedValue(device);

    const response = await request(app)
      .post(`${env.API_PREFIX}/devices`)
      .set("Authorization", "Bearer staff-token")
      .send({ customerId: 2, categoryId: 1, model: "Model X" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "RECEPTIONIST" }),
      { customerId: 2, categoryId: 1, model: "Model X" },
    );
  });

  it("rejects malformed IMEI before calling the service", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const create = vi.spyOn(deviceService, "create");

    const response = await request(app)
      .post(`${env.API_PREFIX}/devices`)
      .set("Authorization", "Bearer customer-token")
      .send({ categoryId: 1, imei: "not-an-imei" });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects roles outside the Phase 3 operational scope", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 5,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId,
    });
    const list = vi.spyOn(deviceService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/devices`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
