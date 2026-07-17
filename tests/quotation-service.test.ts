import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { QuotationItemRow, QuotationRow } from "../src/modules/quotations/quotation.model.js";
import type { QuotationRepository } from "../src/modules/quotations/quotation.repository.js";
import { QuotationService } from "../src/modules/quotations/quotation.service.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const now = new Date("2026-07-15T08:00:00.000Z");
const future = new Date("2026-07-20T08:00:00.000Z");
const past = new Date("2026-07-14T08:00:00.000Z");
const manager = {
  id: 5,
  email: "manager@example.com",
  role: "MANAGER" as const,
  sessionId: "47cb6cce-9789-4225-ac66-ab856ef49f93",
};
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "2c7063b2-cd1e-4f65-a4a1-28c1ab59b1c6",
};
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };

function ticket(overrides: Record<string, unknown> = {}): RepairTicketRow {
  return {
    id: 10,
    ticket_code: "RT-2026-000010",
    customer_id: 2,
    customer_name: "Customer User",
    device_id: 7,
    device_model: "Model X",
    device_serial_number: null,
    device_category: "Smartphone",
    device_brand: null,
    created_by: 4,
    creator_name: "Receptionist",
    title: "Screen is broken",
    customer_issue: "The screen does not display anything",
    initial_condition: null,
    accessories_received: null,
    status: "WAITING_FOR_QUOTATION",
    priority: "NORMAL",
    expected_diagnosis_at: null,
    expected_completion_at: null,
    received_at: now,
    completed_at: null,
    delivered_at: null,
    closed_at: null,
    cancellation_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as RepairTicketRow;
}

function quotation(overrides: Record<string, unknown> = {}): QuotationRow {
  return {
    id: 30,
    ticket_id: 10,
    diagnosis_id: 20,
    version: 1,
    status: "DRAFT",
    labor_amount: 250,
    parts_amount: 500,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 750,
    expires_at: future,
    created_by: 5,
    created_by_name: "Manager",
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    sent_at: null,
    customer_responded_at: null,
    customer_response_note: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as QuotationRow;
}

function itemRows(): QuotationItemRow[] {
  return [
    {
      id: 40,
      quotation_id: 30,
      item_type: "LABOR",
      part_id: null,
      description: "Labor - Replace display",
      quantity: 1,
      unit_price: 250,
      line_total: 250,
      created_at: now,
    } as QuotationItemRow,
    {
      id: 41,
      quotation_id: 30,
      item_type: "PART",
      part_id: 4,
      description: "LCD-1 - Display",
      quantity: 2,
      unit_price: 250,
      line_total: 500,
      created_at: now,
    } as QuotationItemRow,
  ];
}

function dependencies() {
  const repository = {
    listByTicket: vi.fn(),
    findById: vi.fn(),
    findCurrentByTicketForUpdate: vi.fn(),
    findApprovedDiagnosisForUpdate: vi.fn(),
    listDiagnosisPartSnapshotsForUpdate: vi.fn(),
    findActiveCatalogPartsForUpdate: vi.fn(),
    nextVersion: vi.fn(),
    create: vi.fn(),
    replaceItems: vi.fn(),
    listItemsByQuotationIds: vi.fn(),
    updateDraft: vi.fn(),
    updateStatus: vi.fn(),
    approve: vi.fn(),
    markSent: vi.fn(),
    recordCustomerResponse: vi.fn(),
    findActiveManagerIds: vi.fn(),
    createNotification: vi.fn(),
  };
  const tickets = {
    findById: vi.fn(),
    hasActiveAssignment: vi.fn(),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection));
  const service = new QuotationService(
    repository as unknown as QuotationRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
    () => now,
  );
  return { service, repository, tickets, auditLogs };
}

describe("QuotationService", () => {
  it("creates a diagnosis estimate with labor and provisional parts", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findCurrentByTicketForUpdate.mockResolvedValue(null);
    deps.repository.findApprovedDiagnosisForUpdate.mockResolvedValue({
      id: 20,
      proposed_solution: "Replace display",
      labor_cost: 250,
    });
    deps.repository.listDiagnosisPartSnapshotsForUpdate.mockResolvedValue([{
      id: 4,
      sku: "LCD-1",
      name: "Display",
      selling_price: 250,
      quantity: 2,
    }]);
    deps.repository.nextVersion.mockResolvedValue(1);
    deps.repository.create.mockResolvedValue(30);
    deps.repository.findById.mockResolvedValue(quotation());
    deps.repository.listItemsByQuotationIds.mockResolvedValue(itemRows());

    const result = await deps.service.create(
      manager,
      10,
      { expiresAt: future },
      metadata,
    );

    expect(result).toMatchObject({ id: 30, version: 1, totalAmount: 750 });
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        diagnosisId: 20,
        laborAmount: 250,
        partsAmount: 500,
        totalAmount: 750,
      }),
    );
    expect(deps.repository.replaceItems).toHaveBeenCalledWith(
      connection,
      30,
      expect.arrayContaining([
        expect.objectContaining({ itemType: "LABOR", partId: null }),
        expect.objectContaining({ itemType: "PART", partId: 4, quantity: 2 }),
      ]),
    );
  });

  it("does not create a supplemental quotation from repair-time part requests", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "WAITING_FOR_PARTS" }));
    deps.repository.findCurrentByTicketForUpdate.mockResolvedValue(null);
    deps.repository.findApprovedDiagnosisForUpdate.mockResolvedValue({
      id: 20,
      proposed_solution: "Replace display",
      labor_cost: 250,
    });
    await expect(deps.service.create(
      manager,
      10,
      { expiresAt: future },
      metadata,
    )).rejects.toMatchObject({ code: "TICKET_NOT_QUOTABLE" });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("supersedes an open version before creating the next one", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findCurrentByTicketForUpdate.mockResolvedValue(quotation());
    deps.repository.findApprovedDiagnosisForUpdate.mockResolvedValue({
      id: 20,
      proposed_solution: "Replace display",
      labor_cost: 250,
    });
    deps.repository.listDiagnosisPartSnapshotsForUpdate.mockResolvedValue([]);
    deps.repository.nextVersion.mockResolvedValue(2);
    deps.repository.create.mockResolvedValue(31);
    deps.repository.findById.mockResolvedValue(quotation({ id: 31, version: 2 }));
    deps.repository.listItemsByQuotationIds.mockResolvedValue([]);

    await deps.service.create(manager, 10, {}, metadata);

    expect(deps.repository.updateStatus).toHaveBeenCalledWith(
      connection,
      30,
      "SUPERSEDED",
    );
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ version: 2 }),
    );
  });

  it("lets a manager adjust provisional part estimates at catalog prices", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(quotation());
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findActiveCatalogPartsForUpdate.mockResolvedValue([{
      id: 4,
      sku: "LCD-1",
      name: "Display",
      selling_price: 300,
    }]);
    deps.repository.listItemsByQuotationIds.mockResolvedValue(itemRows());

    await deps.service.update(
      manager,
      30,
      { items: [{ itemType: "PART", partId: 4, quantity: 2 }] },
      metadata,
    );
    expect(deps.repository.updateDraft).toHaveBeenCalledWith(
      connection,
      30,
      future,
      expect.objectContaining({ partsAmount: 600, totalAmount: 600 }),
    );
    expect(deps.repository.replaceItems).toHaveBeenCalledWith(
      connection,
      30,
      [expect.objectContaining({ unitPrice: 300, lineTotal: 600 })],
    );
  });

  it("sends only an approved unexpired quotation and transitions the ticket", async () => {
    const deps = dependencies();
    const approved = quotation({
      status: "APPROVED",
      approved_by: 5,
      approved_by_name: "Manager",
      approved_at: now,
    });
    deps.repository.findById
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(quotation({ ...approved, status: "SENT", sent_at: now }));
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listItemsByQuotationIds.mockResolvedValue(itemRows());

    await deps.service.send(manager, 30, undefined, metadata);

    expect(deps.repository.markSent).toHaveBeenCalledWith(connection, 30);
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "WAITING_FOR_CUSTOMER_APPROVAL",
    );
    expect(deps.repository.createNotification).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ userId: 2, type: "QUOTATION_SENT" }),
    );
  });

  it("starts repair after the customer accepts the diagnosis estimate", async () => {
    const deps = dependencies();
    const sent = quotation({ status: "SENT", sent_at: now });
    deps.repository.findById
      .mockResolvedValueOnce(sent)
      .mockResolvedValueOnce(sent)
      .mockResolvedValueOnce(quotation({ status: "ACCEPTED", sent_at: now }));
    deps.tickets.findById.mockResolvedValue(
      ticket({ status: "WAITING_FOR_CUSTOMER_APPROVAL" }),
    );
    deps.repository.findActiveManagerIds.mockResolvedValue([5]);
    deps.repository.listItemsByQuotationIds.mockResolvedValue(itemRows());

    const result = await deps.service.accept(customer, 30, "Approved", metadata);

    expect(result.status).toBe("ACCEPTED");
    expect(deps.repository.recordCustomerResponse).toHaveBeenCalledWith(
      connection,
      30,
      "ACCEPTED",
      "Approved",
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "REPAIRING",
    );
  });

  it("materializes expiry and returns the ticket for a replacement version", async () => {
    const deps = dependencies();
    const expired = quotation({ status: "SENT", sent_at: past, expires_at: past });
    deps.repository.findById.mockResolvedValue(expired);
    deps.tickets.findById.mockResolvedValue(
      ticket({ status: "WAITING_FOR_CUSTOMER_APPROVAL" }),
    );
    deps.repository.findActiveManagerIds.mockResolvedValue([5]);

    await expect(
      deps.service.accept(customer, 30, undefined, metadata),
    ).rejects.toMatchObject({ code: "QUOTATION_EXPIRED" });

    expect(deps.repository.updateStatus).toHaveBeenCalledWith(
      connection,
      30,
      "EXPIRED",
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "WAITING_FOR_QUOTATION",
    );
  });

  it("does not expose an unsent quotation through the customer detail endpoint", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(quotation({ sent_at: null }));
    deps.tickets.findById.mockResolvedValue(ticket());

    await expect(deps.service.getById(customer, 30)).rejects.toMatchObject({
      code: "QUOTATION_NOT_FOUND",
    });
  });
});
