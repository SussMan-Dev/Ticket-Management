import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { quotationService } from "../src/modules/quotations/quotation.service.js";

const sessionId = "47cb6cce-9789-4225-ac66-ab856ef49f93";
const quotation = {
  id: 30,
  ticketId: 10,
  diagnosisId: 20,
  version: 1,
  status: "DRAFT" as const,
  laborAmount: 250,
  partsAmount: 500,
  otherAmount: 0,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 750,
  expiresAt: new Date("2026-07-20T08:00:00.000Z"),
  createdBy: { id: 5, fullName: "Manager" },
  approvedBy: null,
  approvedAt: null,
  sentAt: null,
  customerRespondedAt: null,
  customerResponseNote: null,
  items: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

function authenticate(role: "MANAGER" | "CUSTOMER" | "RECEPTIONIST") {
  vi.spyOn(authService, "authenticate").mockResolvedValue({
    id: role === "CUSTOMER" ? 2 : role === "RECEPTIONIST" ? 4 : 5,
    email: `${role.toLowerCase()}@example.com`,
    role,
    sessionId,
  });
}

describe("quotation API", () => {
  it("allows a manager to create a quotation with a validated expiry", async () => {
    authenticate("MANAGER");
    const create = vi.spyOn(quotationService, "create").mockResolvedValue(quotation);

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/quotations`)
      .set("Authorization", "Bearer manager-token")
      .send({ expiresAt: "2026-07-20T08:00:00.000Z" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, role: "MANAGER" }),
      10,
      expect.objectContaining({ expiresAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it("rejects a client-supplied price for a catalog part", async () => {
    authenticate("MANAGER");
    const update = vi.spyOn(quotationService, "update");

    const response = await request(app)
      .patch(`${env.API_PREFIX}/quotations/30`)
      .set("Authorization", "Bearer manager-token")
      .send({
        items: [{ itemType: "PART", partId: 4, quantity: 1, unitPrice: 1 }],
      });

    expect(response.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it("dispatches the send action without losing controller context", async () => {
    authenticate("MANAGER");
    const send = vi.spyOn(quotationService, "send").mockResolvedValue({
      ...quotation,
      status: "SENT",
      sentAt: new Date(),
    });

    const response = await request(app)
      .post(`${env.API_PREFIX}/quotations/30/send`)
      .set("Authorization", "Bearer manager-token")
      .send({ reason: "Ready for customer" });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ role: "MANAGER" }),
      30,
      "Ready for customer",
      expect.anything(),
    );
  });

  it("allows a customer to accept with an optional response note", async () => {
    authenticate("CUSTOMER");
    const accept = vi.spyOn(quotationService, "accept").mockResolvedValue({
      ...quotation,
      status: "ACCEPTED",
      sentAt: new Date(),
      customerRespondedAt: new Date(),
    });

    const response = await request(app)
      .post(`${env.API_PREFIX}/quotations/30/accept`)
      .set("Authorization", "Bearer customer-token")
      .send({ note: "I agree" });

    expect(response.status).toBe(200);
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      30,
      "I agree",
      expect.anything(),
    );
  });

  it("blocks receptionists from quotation reads", async () => {
    authenticate("RECEPTIONIST");
    const list = vi.spyOn(quotationService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/10/quotations`)
      .set("Authorization", "Bearer receptionist-token");

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
