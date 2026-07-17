import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { paymentService } from "../src/modules/payments/payment.service.js";

const sessionId = "841922bd-d85c-40e7-952e-a8615676375a";
const now = new Date();
const invoice = {
  id: 40,
  invoiceCode: "INV-2026-000040",
  ticket: { id: 10, ticketCode: "RT-2026-000010", status: "COMPLETED" },
  customer: { id: 2, fullName: "Customer", email: "customer@example.com" },
  subtotal: 1_000,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 1_000,
  paidAmount: 0,
  balanceAmount: 1_000,
  paymentStatus: "UNPAID" as const,
  createdBy: { id: 7, fullName: "Cashier" },
  createdAt: now,
  updatedAt: now,
  costBreakdown: {
    lines: [],
    serviceSubtotal: 1_000,
    partSubtotal: 0,
    subtotal: 1_000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 1_000,
  },
};
const payment = {
  id: 50,
  paymentCode: "PAY-2026-000050",
  invoiceId: 40,
  ticketId: 10,
  amount: 400,
  method: "CASH" as const,
  status: "COMPLETED" as const,
  transactionReference: null,
  receivedBy: { id: 7, fullName: "Cashier" },
  paidAt: now,
  note: null,
  createdAt: now,
};

afterEach(() => vi.restoreAllMocks());

function authenticate(role: "CUSTOMER" | "CASHIER" | "MANAGER") {
  vi.spyOn(authService, "authenticate").mockResolvedValue({
    id: role === "CUSTOMER" ? 2 : role === "CASHIER" ? 7 : 5,
    email: `${role.toLowerCase()}@example.com`,
    role,
    sessionId,
  });
}

describe("payments API", () => {
  it("lets a cashier preview the itemized invoice cost", async () => {
    authenticate("CASHIER");
    const preview = vi.spyOn(paymentService, "previewInvoice").mockResolvedValue({
      ticket: { id: 10, ticketCode: "RT-2026-000010", title: "Screen failure" },
      customer: { id: 2, fullName: "Customer" },
      costBreakdown: invoice.costBreakdown,
    });
    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/10/invoice-preview`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.body.data.costBreakdown.totalAmount).toBe(1_000);
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, role: "CASHIER" }),
      10,
    );
  });

  it("lets a cashier create an invoice for a completed ticket", async () => {
    authenticate("CASHIER");
    const create = vi.spyOn(paymentService, "createInvoice").mockResolvedValue(invoice);
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/invoices`)
      .set("Authorization", "Bearer token")
      .send();

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, role: "CASHIER" }),
      10,
      expect.anything(),
    );
  });

  it("scopes invoice listing through the authenticated customer", async () => {
    authenticate("CUSTOMER");
    const list = vi.spyOn(paymentService, "listInvoices")
      .mockResolvedValue({ invoices: [invoice], total: 1 });
    const response = await request(app)
      .get(`${env.API_PREFIX}/invoices?page=1&limit=20`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("records a validated partial payment", async () => {
    authenticate("CASHIER");
    const create = vi.spyOn(paymentService, "createPayment")
      .mockResolvedValue(payment);
    const response = await request(app)
      .post(`${env.API_PREFIX}/invoices/40/payments`)
      .set("Authorization", "Bearer token")
      .send({ amount: 400, method: "CASH" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      40,
      expect.objectContaining({ amount: 400, method: "CASH" }),
      expect.anything(),
    );
  });

  it("rejects payment amounts with more than two decimals", async () => {
    authenticate("CASHIER");
    const create = vi.spyOn(paymentService, "createPayment");
    const response = await request(app)
      .post(`${env.API_PREFIX}/invoices/40/payments`)
      .set("Authorization", "Bearer token")
      .send({ amount: 10.123, method: "CASH" });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps invoice mutation cashier-only", async () => {
    authenticate("MANAGER");
    const create = vi.spyOn(paymentService, "createPayment");
    const response = await request(app)
      .post(`${env.API_PREFIX}/invoices/40/payments`)
      .set("Authorization", "Bearer token")
      .send({ amount: 400, method: "CASH" });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("requires explicit manager approval data for a refund", async () => {
    authenticate("CASHIER");
    const refund = vi.spyOn(paymentService, "refundPayment");
    const response = await request(app)
      .post(`${env.API_PREFIX}/payments/50/refund`)
      .set("Authorization", "Bearer token")
      .send({ reason: "Customer adjustment" });

    expect(response.status).toBe(422);
    expect(refund).not.toHaveBeenCalled();
  });

  it("returns minimal active manager choices to cashiers", async () => {
    authenticate("CASHIER");
    const approvers = vi.spyOn(paymentService, "listRefundApprovers")
      .mockResolvedValue([{ id: 5, fullName: "Manager" }]);
    const response = await request(app)
      .get(`${env.API_PREFIX}/payments/refund-approvers`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 5, fullName: "Manager" }]);
    expect(approvers).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
