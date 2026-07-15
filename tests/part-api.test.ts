import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { partService } from "../src/modules/parts/part.service.js";

const sessionId = "841922bd-d85c-40e7-952e-a8615676375a";
const part = {
  id: 4,
  sku: "LCD-1",
  name: "Display assembly",
  description: null,
  unit: "piece",
  purchasePrice: 200,
  sellingPrice: 300,
  quantityOnHand: 5,
  minimumStock: 2,
  isLowStock: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => vi.restoreAllMocks());

function authenticate(role: "TECHNICIAN" | "INVENTORY_STAFF" | "MANAGER") {
  vi.spyOn(authService, "authenticate").mockResolvedValue({
    id: role === "TECHNICIAN" ? 6 : role === "MANAGER" ? 5 : 7,
    email: `${role.toLowerCase()}@example.com`,
    role,
    sessionId,
  });
}

describe("parts API", () => {
  it("lists validated part filters for a technician", async () => {
    authenticate("TECHNICIAN");
    const list = vi.spyOn(partService, "list").mockResolvedValue({ parts: [], total: 0 });
    const response = await request(app)
      .get(`${env.API_PREFIX}/parts?lowStock=true&page=1`)
      .set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ role: "TECHNICIAN" }),
      expect.objectContaining({ lowStock: true, page: 1 }),
    );
  });

  it("creates a part without accepting an initial stock balance", async () => {
    authenticate("INVENTORY_STAFF");
    const create = vi.spyOn(partService, "create").mockResolvedValue(part);
    const response = await request(app)
      .post(`${env.API_PREFIX}/parts`)
      .set("Authorization", "Bearer token")
      .send({ sku: "lcd-1", name: "Display assembly", quantityOnHand: 20 });
    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("normalizes a valid SKU and applies safe catalog defaults", async () => {
    authenticate("INVENTORY_STAFF");
    const create = vi.spyOn(partService, "create").mockResolvedValue(part);
    const response = await request(app)
      .post(`${env.API_PREFIX}/parts`)
      .set("Authorization", "Bearer token")
      .send({ sku: "lcd-1", name: "Display assembly" });
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "INVENTORY_STAFF" }),
      expect.objectContaining({
        sku: "LCD-1",
        unit: "piece",
        purchasePrice: 0,
        sellingPrice: 0,
      }),
      expect.anything(),
    );
  });

  it("rejects zero stock adjustments before the service", async () => {
    authenticate("INVENTORY_STAFF");
    const adjust = vi.spyOn(partService, "adjustStock");
    const response = await request(app)
      .post(`${env.API_PREFIX}/parts/4/adjust-stock`)
      .set("Authorization", "Bearer token")
      .send({ quantityChange: 0, note: "Physical count" });
    expect(response.status).toBe(422);
    expect(adjust).not.toHaveBeenCalled();
  });

  it("blocks technicians from stock-in at route authorization", async () => {
    authenticate("TECHNICIAN");
    const stockIn = vi.spyOn(partService, "stockIn");
    const response = await request(app)
      .post(`${env.API_PREFIX}/parts/4/stock-in`)
      .set("Authorization", "Bearer token")
      .send({ quantity: 3, note: "Supplier receipt" });
    expect(response.status).toBe(403);
    expect(stockIn).not.toHaveBeenCalled();
  });
});
