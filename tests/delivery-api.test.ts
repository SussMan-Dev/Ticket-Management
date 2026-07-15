import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { deliveryService } from "../src/modules/deliveries/delivery.service.js";

const delivery = { id: 8, ticket: { id: 10, ticketCode: "RT-10" }, deliveredBy: { id: 4, fullName: "Receptionist" }, recipientName: "Customer", recipientPhone: null, proofUrl: null, note: null, deliveredAt: new Date() };
afterEach(() => vi.restoreAllMocks());
function authenticate(role: "CUSTOMER" | "RECEPTIONIST" | "MANAGER" | "TECHNICIAN") { vi.spyOn(authService, "authenticate").mockResolvedValue({ id: role === "CUSTOMER" ? 2 : 4, email: `${role}@example.com`, role, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" }); }

describe("delivery API", () => {
  it("records a validated receptionist handover", async () => {
    authenticate("RECEPTIONIST");
    const deliver = vi.spyOn(deliveryService, "deliver").mockResolvedValue(delivery);
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/deliver`).set("Authorization", "Bearer token").send({ recipientName: "Customer", proofUrl: "https://example.com/proof.jpg" });
    expect(response.status).toBe(201);
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ role: "RECEPTIONIST" }), 10, expect.objectContaining({ recipientName: "Customer" }), expect.anything());
  });

  it("rejects malformed proof URLs before business logic", async () => {
    authenticate("RECEPTIONIST");
    const deliver = vi.spyOn(deliveryService, "deliver");
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/deliver`).set("Authorization", "Bearer token").send({ recipientName: "Customer", proofUrl: "javascript:alert(1)" });
    expect(response.status).toBe(422);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("keeps technicians out of the delivery route", async () => {
    authenticate("TECHNICIAN");
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/deliver`).set("Authorization", "Bearer token").send({ recipientName: "Customer" });
    expect(response.status).toBe(403);
  });

  it("closes a delivered ticket through operational staff", async () => {
    authenticate("RECEPTIONIST");
    const close = vi.spyOn(deliveryService, "close").mockResolvedValue({ ticketId: 10, status: "CLOSED" });
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/close`).set("Authorization", "Bearer token").send({ reason: "Handover completed" });
    expect(response.status).toBe(200);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ role: "RECEPTIONIST" }), 10, { reason: "Handover completed" }, expect.anything());
  });
});
