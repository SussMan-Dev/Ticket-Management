import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { inventoryService } from "../src/modules/inventory/inventory.service.js";

const sessionId = "841922bd-d85c-40e7-952e-a8615676375a";
const partRequest = {
  id: 15,
  ticket: { id: 10, ticketCode: "RT-2026-000010" },
  requestedBy: { id: 6, fullName: "Technician" },
  status: "PENDING" as const,
  note: null,
  approvedBy: null,
  approvedAt: null,
  items: [],
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

describe("inventory API", () => {
  it("creates a validated unique-part request for a technician", async () => {
    authenticate("TECHNICIAN");
    const create = vi.spyOn(inventoryService, "create").mockResolvedValue(partRequest);
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/part-requests`)
      .set("Authorization", "Bearer token")
      .send({ items: [{ partId: 4, requestedQuantity: 2 }] });
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 6, role: "TECHNICIAN" }),
      10,
      expect.objectContaining({ items: [{ partId: 4, requestedQuantity: 2 }] }),
      expect.anything(),
    );
  });

  it("rejects duplicate request parts before service execution", async () => {
    authenticate("TECHNICIAN");
    const create = vi.spyOn(inventoryService, "create");
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/part-requests`)
      .set("Authorization", "Bearer token")
      .send({
        items: [
          { partId: 4, requestedQuantity: 1 },
          { partId: 4, requestedQuantity: 2 },
        ],
      });
    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows inventory staff to approve a request", async () => {
    authenticate("INVENTORY_STAFF");
    const approve = vi.spyOn(inventoryService, "approve").mockResolvedValue({
      ...partRequest,
      status: "APPROVED",
      approvedBy: { id: 7, fullName: "Inventory" },
      approvedAt: new Date(),
    });
    const response = await request(app)
      .post(`${env.API_PREFIX}/part-requests/15/approve`)
      .set("Authorization", "Bearer token")
      .send({ reason: "Stock verified" });
    expect(response.status).toBe(200);
    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({ role: "INVENTORY_STAFF" }),
      15,
      "Stock verified",
      expect.anything(),
    );
  });

  it("validates positive fulfillment quantities", async () => {
    authenticate("INVENTORY_STAFF");
    const fulfill = vi.spyOn(inventoryService, "fulfill");
    const response = await request(app)
      .post(`${env.API_PREFIX}/part-requests/15/fulfill`)
      .set("Authorization", "Bearer token")
      .send({ items: [{ partId: 4, quantity: 0 }] });
    expect(response.status).toBe(422);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("keeps managers read-only for part-request actions", async () => {
    authenticate("MANAGER");
    const reject = vi.spyOn(inventoryService, "reject");
    const response = await request(app)
      .post(`${env.API_PREFIX}/part-requests/15/reject`)
      .set("Authorization", "Bearer token")
      .send({ reason: "Not authorized" });
    expect(response.status).toBe(403);
    expect(reject).not.toHaveBeenCalled();
  });
});
