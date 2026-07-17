import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type {
  InvoiceRow,
  PaymentRow,
} from "../src/modules/payments/payment.model.js";
import type { PaymentRepository } from "../src/modules/payments/payment.repository.js";
import { PaymentService } from "../src/modules/payments/payment.service.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const cashier = {
  id: 7,
  email: "cashier@example.com",
  role: "CASHIER" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "841922bd-d85c-40e7-952e-a8615676375a",
};

function ticket(overrides: Record<string, unknown> = {}): RepairTicketRow {
  const now = new Date();
  return {
    id: 10,
    ticket_code: "RT-2026-000010",
    customer_id: 2,
    customer_name: "Customer",
    device_id: 3,
    device_model: "Model X",
    device_serial_number: null,
    device_category: "Phone",
    device_brand: null,
    created_by: 4,
    creator_name: "Receptionist",
    title: "Screen failure",
    customer_issue: "No display",
    initial_condition: null,
    accessories_received: null,
    status: "COMPLETED",
    priority: "NORMAL",
    expected_diagnosis_at: null,
    expected_completion_at: null,
    received_at: now,
    completed_at: now,
    delivered_at: null,
    closed_at: null,
    cancellation_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as RepairTicketRow;
}

function invoice(overrides: Record<string, unknown> = {}): InvoiceRow {
  const now = new Date();
  return {
    id: 40,
    invoice_code: "INV-2026-000040",
    ticket_id: 10,
    ticket_code: "RT-2026-000010",
    ticket_status: "COMPLETED",
    customer_id: 2,
    customer_name: "Customer",
    customer_email: "customer@example.com",
    subtotal: 1_000,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 1_000,
    paid_amount: 0,
    payment_status: "UNPAID",
    created_by: 7,
    created_by_name: "Cashier",
    created_at: now,
    updated_at: now,
    ...overrides,
  } as InvoiceRow;
}

function payment(overrides: Record<string, unknown> = {}): PaymentRow {
  const now = new Date();
  return {
    id: 50,
    payment_code: "PAY-2026-000050",
    invoice_id: 40,
    ticket_id: 10,
    amount: 400,
    method: "CASH",
    status: "COMPLETED",
    transaction_reference: null,
    received_by: 7,
    received_by_name: "Cashier",
    paid_at: now,
    note: null,
    created_at: now,
    ...overrides,
  } as PaymentRow;
}

function dependencies() {
  const repository = {
    listInvoices: vi.fn(),
    findInvoiceById: vi.fn(),
    findInvoiceByTicket: vi.fn(),
    findAcceptedQuotationSnapshot: vi.fn(),
    listAcceptedQuotationItems: vi.fn().mockResolvedValue([]),
    listFulfilledPartTotals: vi.fn().mockResolvedValue([]),
    createInvoice: vi.fn().mockResolvedValue(40),
    setInvoiceCode: vi.fn(),
    updateInvoiceBalance: vi.fn(),
    listPayments: vi.fn().mockResolvedValue([]),
    findPaymentById: vi.fn(),
    createPayment: vi.fn().mockResolvedValue(50),
    setPaymentCode: vi.fn(),
    markPaymentRefunded: vi.fn(),
    findActiveManager: vi.fn(),
    listActiveManagers: vi.fn().mockResolvedValue([]),
    createNotification: vi.fn(),
  };
  const tickets = {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection));
  const service = new PaymentService(
    repository as unknown as PaymentRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
    () => new Date("2026-07-15T00:00:00.000Z"),
  );
  return { service, repository, tickets, auditLogs };
}

describe("PaymentService", () => {
  it("previews every server-derived cost before a cashier issues the invoice", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findInvoiceByTicket.mockResolvedValue(null);
    deps.repository.findAcceptedQuotationSnapshot.mockResolvedValue({
      id: 30,
      subtotal: 1_000,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 950,
    });
    deps.repository.listAcceptedQuotationItems.mockResolvedValue([
      { item_type: "LABOR", description: "Repair labor", part_id: null, quantity: 1, unit_price: 400, line_total: 400 },
      { item_type: "PART", description: "Provisional screen", part_id: 4, quantity: 2, unit_price: 300, line_total: 600 },
    ]);
    deps.repository.listFulfilledPartTotals.mockResolvedValue([
      { part_id: 4, part_sku: "SCR-01", part_name: "Screen assembly", part_unit: "piece", quantity: 1, unit_price: 300 },
    ]);

    const result = await deps.service.previewInvoice(cashier, 10);

    expect(result).toMatchObject({
      ticket: { id: 10, ticketCode: "RT-2026-000010" },
      customer: { id: 2, fullName: "Customer" },
      costBreakdown: {
        serviceSubtotal: 400,
        partSubtotal: 300,
        subtotal: 700,
        discountAmount: 100,
        taxAmount: 50,
        totalAmount: 650,
      },
    });
    expect(result.costBreakdown.lines).toEqual([
      expect.objectContaining({ type: "LABOR", lineTotal: 400 }),
      expect.objectContaining({
        type: "PART",
        lineTotal: 300,
        part: expect.objectContaining({ sku: "SCR-01" }),
      }),
    ]);
    expect(deps.repository.createInvoice).not.toHaveBeenCalled();
  });

  it("creates an invoice from the accepted server-side quotation snapshot", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findInvoiceByTicket.mockResolvedValue(null);
    deps.repository.findAcceptedQuotationSnapshot.mockResolvedValue({
      id: 30,
      subtotal: 1_000,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 950,
    });
    deps.repository.listAcceptedQuotationItems.mockResolvedValue([
      {
        item_type: "LABOR",
        description: "Screen replacement labor",
        part_id: null,
        quantity: 1,
        unit_price: 400,
        line_total: 400,
      },
      {
        item_type: "PART",
        description: "Screen assembly",
        part_id: 4,
        quantity: 2,
        unit_price: 300,
        line_total: 600,
      },
    ]);
    deps.repository.listFulfilledPartTotals.mockResolvedValue([
      { part_id: 4, part_sku: "SCR-01", part_name: "Screen assembly", part_unit: "piece", quantity: 2, unit_price: 300 },
    ]);
    deps.repository.findInvoiceById.mockResolvedValue(invoice({
      subtotal: 1_000,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 950,
    }));

    const result = await deps.service.createInvoice(cashier, 10, metadata);

    expect(result.totalAmount).toBe(950);
    expect(deps.repository.createInvoice).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        ticketId: 10,
        subtotal: 1_000,
        discountAmount: 100,
        taxAmount: 50,
        totalAmount: 950,
      }),
    );
    expect(deps.repository.setInvoiceCode).toHaveBeenCalledWith(
      connection,
      40,
      "INV-2026-000040",
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "INVOICE_CREATED" }),
    );
  });

  it("charges the quantity fulfilled by inventory during repair", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findInvoiceByTicket.mockResolvedValue(null);
    deps.repository.findAcceptedQuotationSnapshot.mockResolvedValue({
      id: 30,
      subtotal: 1_000,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 1_000,
    });
    deps.repository.listAcceptedQuotationItems.mockResolvedValue([
      { item_type: "LABOR", description: "Repair labor", part_id: null, quantity: 1, unit_price: 400, line_total: 400 },
      { item_type: "PART", description: "Screen assembly", part_id: 4, quantity: 2, unit_price: 300, line_total: 600 },
    ]);
    deps.repository.listFulfilledPartTotals.mockResolvedValue([
      { part_id: 4, part_sku: "SCR-01", part_name: "Screen assembly", part_unit: "piece", quantity: 1, unit_price: 300 },
    ]);
    deps.repository.findInvoiceById.mockResolvedValue(invoice({
      subtotal: 700,
      total_amount: 700,
    }));

    await deps.service.createInvoice(cashier, 10, metadata);

    expect(deps.repository.createInvoice).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ subtotal: 700, totalAmount: 700 }),
    );
  });

  it("charges fulfilled repair parts even when they were absent from the diagnosis estimate", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findInvoiceByTicket.mockResolvedValue(null);
    deps.repository.findAcceptedQuotationSnapshot.mockResolvedValue({
      id: 30,
      subtotal: 400,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 400,
    });
    deps.repository.listAcceptedQuotationItems.mockResolvedValue([
      { item_type: "LABOR", description: "Repair labor", part_id: null, quantity: 1, unit_price: 400, line_total: 400 },
    ]);
    deps.repository.listFulfilledPartTotals.mockResolvedValue([
      { part_id: 4, part_sku: "SCR-01", part_name: "Screen assembly", part_unit: "piece", quantity: 1, unit_price: 500 },
    ]);
    deps.repository.findInvoiceById.mockResolvedValue(invoice({
      subtotal: 900,
      total_amount: 900,
    }));

    await deps.service.createInvoice(cashier, 10, metadata);

    expect(deps.repository.createInvoice).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ subtotal: 900, totalAmount: 900 }),
    );
  });

  it("rejects a duplicate invoice for the same ticket", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findInvoiceByTicket.mockResolvedValue(invoice());

    await expect(deps.service.createInvoice(cashier, 10, metadata))
      .rejects.toMatchObject({ code: "INVOICE_ALREADY_EXISTS" });
    expect(deps.repository.createInvoice).not.toHaveBeenCalled();
  });

  it("records a partial payment and updates the balance atomically", async () => {
    const deps = dependencies();
    deps.repository.findInvoiceById.mockResolvedValue(invoice());
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findPaymentById.mockResolvedValue(payment());

    const result = await deps.service.createPayment(cashier, 40, {
      amount: 400,
      method: "CASH",
    }, metadata);

    expect(result.id).toBe(50);
    expect(deps.repository.updateInvoiceBalance).toHaveBeenCalledWith(
      connection,
      40,
      400,
      "PARTIALLY_PAID",
    );
    expect(deps.tickets.updateStatus).not.toHaveBeenCalled();
  });

  it("moves a fully paid completed ticket to delivery readiness", async () => {
    const deps = dependencies();
    deps.repository.findInvoiceById.mockResolvedValue(invoice({ paid_amount: 600 }));
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findPaymentById.mockResolvedValue(payment());

    await deps.service.createPayment(cashier, 40, {
      amount: 400,
      method: "BANK_TRANSFER",
      transactionReference: "BANK-123",
    }, metadata);

    expect(deps.repository.updateInvoiceBalance).toHaveBeenCalledWith(
      connection,
      40,
      1_000,
      "PAID",
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "READY_FOR_DELIVERY",
    );
    expect(deps.tickets.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        fromStatus: "COMPLETED",
        toStatus: "READY_FOR_DELIVERY",
      }),
    );
  });

  it("rejects payment above the locked outstanding balance", async () => {
    const deps = dependencies();
    deps.repository.findInvoiceById.mockResolvedValue(invoice({ paid_amount: 900 }));
    deps.tickets.findById.mockResolvedValue(ticket());

    await expect(deps.service.createPayment(cashier, 40, {
      amount: 101,
      method: "CASH",
    }, metadata)).rejects.toMatchObject({
      code: "PAYMENT_EXCEEDS_BALANCE",
      details: { balanceAmount: 100 },
    });
    expect(deps.repository.createPayment).not.toHaveBeenCalled();
  });

  it("refunds one immutable payment with manager approval and revokes readiness", async () => {
    const deps = dependencies();
    deps.repository.findPaymentById.mockResolvedValue(payment());
    deps.tickets.findById.mockResolvedValue(ticket({ status: "READY_FOR_DELIVERY" }));
    deps.repository.findInvoiceById.mockResolvedValue(invoice({
      paid_amount: 1_000,
      payment_status: "PAID",
    }));
    deps.repository.findActiveManager.mockResolvedValue({ id: 5, full_name: "Manager" });

    const result = await deps.service.refundPayment(cashier, 50, {
      managerApprovalId: 5,
      reason: "Approved customer refund",
    }, metadata);

    expect(result.status).toBe("COMPLETED");
    expect(deps.repository.markPaymentRefunded).toHaveBeenCalledWith(connection, 50);
    expect(deps.repository.updateInvoiceBalance).toHaveBeenCalledWith(
      connection,
      40,
      600,
      "PARTIALLY_REFUNDED",
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "COMPLETED",
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        action: "PAYMENT_REFUNDED",
        newData: expect.objectContaining({ approvedBy: { id: 5, fullName: "Manager" } }),
      }),
    );
  });

  it("enforces customer ownership when reading an invoice", async () => {
    const deps = dependencies();
    deps.repository.findInvoiceById.mockResolvedValue(invoice({ customer_id: 99 }));

    await expect(deps.service.getInvoice(customer, 40))
      .rejects.toMatchObject({ code: "INVOICE_ACCESS_DENIED" });
  });

  it("returns the itemized cost breakdown on invoice detail", async () => {
    const deps = dependencies();
    deps.repository.findInvoiceById.mockResolvedValue(invoice({
      subtotal: 700,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 650,
    }));
    deps.repository.findAcceptedQuotationSnapshot.mockResolvedValue({
      id: 30,
      subtotal: 1_000,
      discount_amount: 100,
      tax_amount: 50,
      total_amount: 950,
    });
    deps.repository.listAcceptedQuotationItems.mockResolvedValue([
      { item_type: "LABOR", description: "Repair labor", part_id: null, quantity: 1, unit_price: 400, line_total: 400 },
    ]);
    deps.repository.listFulfilledPartTotals.mockResolvedValue([
      { part_id: 4, part_sku: "SCR-01", part_name: "Screen assembly", part_unit: "piece", quantity: 1, unit_price: 300 },
    ]);

    const result = await deps.service.getInvoice(customer, 40);

    expect(result.costBreakdown).toMatchObject({
      serviceSubtotal: 400,
      partSubtotal: 300,
      subtotal: 700,
      totalAmount: 650,
    });
  });

  it("returns only active manager refund approvers to a cashier", async () => {
    const deps = dependencies();
    deps.repository.listActiveManagers.mockResolvedValue([
      { id: 5, full_name: "Manager One" },
    ]);

    await expect(deps.service.listRefundApprovers(cashier)).resolves.toEqual([
      { id: 5, fullName: "Manager One" },
    ]);
  });
});
