import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { PartRow } from "../src/modules/parts/part.model.js";
import type { PartRepository } from "../src/modules/parts/part.repository.js";
import { PartService } from "../src/modules/parts/part.service.js";

const connection = {} as PoolConnection;
const inventoryStaff = {
  id: 7,
  email: "inventory@example.com",
  role: "INVENTORY_STAFF" as const,
  sessionId: "841922bd-d85c-40e7-952e-a8615676375a",
};
const technician = {
  id: 6,
  email: "technician@example.com",
  role: "TECHNICIAN" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const manager = {
  id: 5,
  email: "manager@example.com",
  role: "MANAGER" as const,
  sessionId: "47cb6cce-9789-4225-ac66-ab856ef49f93",
};
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };

function part(overrides: Record<string, unknown> = {}): PartRow {
  const now = new Date();
  return {
    id: 4,
    sku: "LCD-1",
    name: "Display assembly",
    description: null,
    unit: "piece",
    purchase_price: 200,
    selling_price: 300,
    quantity_on_hand: 5,
    minimum_stock: 2,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as PartRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findByIdsForUpdate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStock: vi.fn(),
    createInventoryTransaction: vi.fn(),
    listInventoryTransactions: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection));
  const service = new PartService(
    repository as unknown as PartRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );
  return { service, repository, auditLogs };
}

describe("PartService", () => {
  it("forces active-only technician reads and hides purchase price", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [part()], total: 1 });

    const result = await deps.service.list(technician, {
      page: 1,
      limit: 20,
      isActive: false,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(deps.repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
    expect(result.parts[0]).not.toHaveProperty("purchasePrice");
    expect(result.parts[0]).toMatchObject({ sku: "LCD-1", quantityOnHand: 5 });
  });

  it("creates catalog entries at zero stock and writes an audit record", async () => {
    const deps = dependencies();
    deps.repository.create.mockResolvedValue(4);
    deps.repository.findById.mockResolvedValue(part({ quantity_on_hand: 0 }));

    const result = await deps.service.create(inventoryStaff, {
      sku: "LCD-1",
      name: "Display assembly",
      unit: "piece",
      purchasePrice: 200,
      sellingPrice: 300,
      minimumStock: 2,
      isActive: true,
    }, metadata);

    expect(result.quantityOnHand).toBe(0);
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.not.objectContaining({ quantityOnHand: expect.anything() }),
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "PART_CREATED", entityId: 4 }),
    );
  });

  it("stocks in atomically with immutable before/after balances", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(part({ quantity_on_hand: 5 }))
      .mockResolvedValueOnce(part({ quantity_on_hand: 8 }));
    deps.repository.createInventoryTransaction.mockResolvedValue(11);

    const result = await deps.service.stockIn(
      inventoryStaff,
      4,
      { quantity: 3, note: "Supplier receipt" },
      metadata,
    );

    expect(result.quantityOnHand).toBe(8);
    expect(deps.repository.updateStock).toHaveBeenCalledWith(connection, 4, 8);
    expect(deps.repository.createInventoryTransaction).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        transactionType: "STOCK_IN",
        quantity: 3,
        quantityBefore: 5,
        quantityAfter: 8,
      }),
    );
  });

  it("refuses an adjustment that would make stock negative", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(part({ quantity_on_hand: 2 }));

    await expect(deps.service.adjustStock(
      inventoryStaff,
      4,
      { quantityChange: -3, note: "Physical count correction" },
      metadata,
    )).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    expect(deps.repository.updateStock).not.toHaveBeenCalled();
    expect(deps.repository.createInventoryTransaction).not.toHaveBeenCalled();
  });

  it("allows managers to read ledger history but not mutate stock", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(part());
    deps.repository.listInventoryTransactions.mockResolvedValue({ rows: [], total: 0 });

    await expect(deps.service.listTransactions(manager, 4, {
      page: 1,
      limit: 20,
    })).resolves.toEqual({ transactions: [], total: 0 });
    await expect(deps.service.stockIn(
      manager,
      4,
      { quantity: 1, note: "Not authorized" },
      metadata,
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

