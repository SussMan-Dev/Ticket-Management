import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type {
  PartRequestItemRow,
  PartRequestRow,
} from "../src/modules/inventory/inventory.model.js";
import type { InventoryRepository } from "../src/modules/inventory/inventory.repository.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import type { PartRow } from "../src/modules/parts/part.model.js";
import type { PartRepository } from "../src/modules/parts/part.repository.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const technician = {
  id: 6,
  email: "technician@example.com",
  role: "TECHNICIAN" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const inventoryStaff = {
  id: 7,
  email: "inventory@example.com",
  role: "INVENTORY_STAFF" as const,
  sessionId: "841922bd-d85c-40e7-952e-a8615676375a",
};
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };

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
    status: "WAITING_FOR_PARTS",
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

function requestRow(overrides: Record<string, unknown> = {}): PartRequestRow {
  const now = new Date();
  return {
    id: 15,
    ticket_id: 10,
    ticket_code: "RT-2026-000010",
    requested_by: 6,
    requested_by_name: "Technician",
    status: "PENDING",
    note: null,
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as PartRequestRow;
}

function requestItem(overrides: Record<string, unknown> = {}): PartRequestItemRow {
  return {
    id: 21,
    part_request_id: 15,
    part_id: 4,
    part_sku: "LCD-1",
    part_name: "Display",
    part_unit: "piece",
    selling_price: 300,
    quantity_on_hand: 5,
    part_is_active: true,
    requested_quantity: 2,
    fulfilled_quantity: 0,
    created_at: new Date(),
    ...overrides,
  } as PartRequestItemRow;
}

function partRow(overrides: Record<string, unknown> = {}): PartRow {
  return {
    id: 4,
    sku: "LCD-1",
    name: "Display",
    description: null,
    unit: "piece",
    purchase_price: 200,
    selling_price: 300,
    quantity_on_hand: 5,
    minimum_stock: 1,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as PartRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    listItemsByRequestIds: vi.fn(),
    create: vi.fn(),
    createItems: vi.fn(),
    approve: vi.fn(),
    updateStatus: vi.fn(),
    addFulfilledQuantity: vi.fn(),
    hasOtherOpenRequests: vi.fn(),
    findActiveInventoryStaffIds: vi.fn(),
    createNotification: vi.fn(),
  };
  const parts = {
    findByIdsForUpdate: vi.fn(),
    updateStock: vi.fn(),
    createInventoryTransaction: vi.fn(),
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
  const service = new InventoryService(
    repository as unknown as InventoryRepository,
    parts as unknown as PartRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );
  return { service, repository, parts, tickets, auditLogs };
}

describe("InventoryService", () => {
  it("creates a request only for the active assignee and pauses an active repair", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "REPAIRING" }));
    deps.tickets.hasActiveAssignment.mockResolvedValue(true);
    deps.parts.findByIdsForUpdate.mockResolvedValue([partRow()]);
    deps.repository.create.mockResolvedValue(15);
    deps.repository.findActiveInventoryStaffIds.mockResolvedValue([7, 8]);
    deps.repository.findById.mockResolvedValue(requestRow());
    deps.repository.listItemsByRequestIds.mockResolvedValue([requestItem()]);

    const result = await deps.service.create(technician, 10, {
      items: [{ partId: 4, requestedQuantity: 2 }],
    }, metadata);

    expect(result.status).toBe("PENDING");
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "WAITING_FOR_PARTS",
    );
    expect(deps.repository.createItems).toHaveBeenCalledWith(
      connection,
      15,
      [{ partId: 4, requestedQuantity: 2 }],
    );
    expect(deps.repository.createNotification).toHaveBeenCalledTimes(2);
  });

  it("rejects request creation without active assignment", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.tickets.hasActiveAssignment.mockResolvedValue(false);

    await expect(deps.service.create(technician, 10, {
      items: [{ partId: 4, requestedQuantity: 1 }],
    }, metadata)).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENT_REQUIRED" });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("scopes technician list and detail reads to their own requests", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [], total: 0 });
    deps.repository.listItemsByRequestIds.mockResolvedValue([]);
    await deps.service.list(technician, { page: 1, limit: 20 });
    expect(deps.repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ requestedBy: 6 }),
    );

    deps.repository.findById.mockResolvedValue(requestRow({ requested_by: 9 }));
    await expect(deps.service.getById(technician, 15)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("approves only pending requests and records notification/audit", async () => {
    const deps = dependencies();
    const pending = requestRow();
    const approved = requestRow({
      status: "APPROVED",
      approved_by: 7,
      approved_by_name: "Inventory",
      approved_at: new Date(),
    });
    deps.repository.findById
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(approved);
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listItemsByRequestIds.mockResolvedValue([requestItem()]);

    const result = await deps.service.approve(
      inventoryStaff,
      15,
      "Stock verified",
      metadata,
    );

    expect(result.status).toBe("APPROVED");
    expect(deps.repository.approve).toHaveBeenCalledWith(connection, 15, 7);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "PART_REQUEST_APPROVED" }),
    );
  });

  it("partially fulfills without advancing the ticket", async () => {
    const deps = dependencies();
    const approved = requestRow({ status: "APPROVED" });
    const partial = requestRow({ status: "PARTIALLY_FULFILLED" });
    deps.repository.findById
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(partial);
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listItemsByRequestIds
      .mockResolvedValueOnce([requestItem({ requested_quantity: 2 })])
      .mockResolvedValueOnce([requestItem({ requested_quantity: 2, fulfilled_quantity: 1 })]);
    deps.parts.findByIdsForUpdate.mockResolvedValue([partRow({ quantity_on_hand: 5 })]);

    const result = await deps.service.fulfill(inventoryStaff, 15, {
      items: [{ partId: 4, quantity: 1 }],
    }, metadata);

    expect(result.status).toBe("PARTIALLY_FULFILLED");
    expect(deps.parts.updateStock).toHaveBeenCalledWith(connection, 4, 4);
    expect(deps.parts.createInventoryTransaction).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        transactionType: "STOCK_OUT",
        quantityBefore: 5,
        quantityAfter: 4,
        referenceType: "PART_REQUEST",
        referenceId: 15,
      }),
    );
    expect(deps.tickets.updateStatus).not.toHaveBeenCalled();
  });

  it("fully fulfills and starts repair when no other request remains", async () => {
    const deps = dependencies();
    const approved = requestRow({ status: "APPROVED" });
    const fulfilled = requestRow({ status: "FULFILLED" });
    deps.repository.findById
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(fulfilled);
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listItemsByRequestIds
      .mockResolvedValueOnce([requestItem({ requested_quantity: 2, fulfilled_quantity: 1 })])
      .mockResolvedValueOnce([requestItem({ requested_quantity: 2, fulfilled_quantity: 2 })]);
    deps.parts.findByIdsForUpdate.mockResolvedValue([partRow()]);
    deps.repository.hasOtherOpenRequests.mockResolvedValue(false);

    const result = await deps.service.fulfill(inventoryStaff, 15, {
      items: [{ partId: 4, quantity: 1 }],
      note: "Issued to technician",
    }, metadata);

    expect(result.status).toBe("FULFILLED");
    expect(deps.repository.updateStatus).toHaveBeenCalledWith(
      connection,
      15,
      "FULFILLED",
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "REPAIRING",
    );
    expect(deps.tickets.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        fromStatus: "WAITING_FOR_PARTS",
        toStatus: "REPAIRING",
      }),
    );
  });

  it("does not mutate request or stock when fulfillment exceeds availability", async () => {
    const deps = dependencies();
    const approved = requestRow({ status: "APPROVED" });
    deps.repository.findById.mockResolvedValue(approved);
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listItemsByRequestIds.mockResolvedValue([
      requestItem({ requested_quantity: 3 }),
    ]);
    deps.parts.findByIdsForUpdate.mockResolvedValue([
      partRow({ quantity_on_hand: 1 }),
    ]);

    await expect(deps.service.fulfill(inventoryStaff, 15, {
      items: [{ partId: 4, quantity: 2 }],
    }, metadata)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(deps.parts.updateStock).not.toHaveBeenCalled();
    expect(deps.repository.addFulfilledQuantity).not.toHaveBeenCalled();
  });
});
