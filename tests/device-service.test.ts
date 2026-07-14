import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { DeviceRow } from "../src/modules/devices/device.model.js";
import type { DeviceRepository } from "../src/modules/devices/device.repository.js";
import { DeviceService } from "../src/modules/devices/device.service.js";

const connection = {} as PoolConnection;
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "2c7063b2-cd1e-4f65-a4a1-28c1ab59b1c6",
};
const receptionist = {
  id: 1,
  email: "receptionist@example.com",
  role: "RECEPTIONIST" as const,
  sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
};

function row(overrides: Record<string, unknown> = {}): DeviceRow {
  const now = new Date();
  return {
    id: 10,
    customer_id: 2,
    customer_name: "Customer User",
    category_id: 1,
    category_name: "Phone",
    brand_id: 1,
    brand_name: "Example Brand",
    model: "Model X",
    serial_number: "SERIAL-1",
    imei: "123456789012345",
    color: "Black",
    description: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as DeviceRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findCustomer: vi.fn(),
    findActiveCategory: vi.fn(),
    findActiveBrand: vi.fn(),
    listActiveCategories: vi.fn(),
    listActiveBrands: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new DeviceService(
    repository as unknown as DeviceRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );

  return { service, repository, transaction };
}

describe("DeviceService", () => {
  it("always scopes customer device lists to the authenticated owner", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [row()], total: 1 });

    const result = await deps.service.list(customer, {
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.total).toBe(1);
    expect(deps.repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 2 }),
    );
    await expect(
      deps.service.list(customer, {
        page: 1,
        limit: 20,
        customerId: 3,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks cross-customer device detail access", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row({ customer_id: 3 }));

    await expect(deps.service.getById(customer, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("creates a customer-owned device only with active references", async () => {
    const deps = dependencies();
    deps.repository.findCustomer.mockResolvedValue({ id: 2, status: "ACTIVE" });
    deps.repository.findActiveCategory.mockResolvedValue({
      id: 1,
      name: "Phone",
      description: null,
      is_active: 1,
    });
    deps.repository.findActiveBrand.mockResolvedValue({
      id: 1,
      name: "Example Brand",
      is_active: 1,
    });
    deps.repository.create.mockResolvedValue(10);
    deps.repository.findById.mockResolvedValue(row());

    const created = await deps.service.create(customer, {
      categoryId: 1,
      brandId: 1,
      model: "Model X",
    });

    expect(created.customer.id).toBe(2);
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ customerId: 2, categoryId: 1 }),
    );
  });

  it("requires staff to choose an active customer", async () => {
    const deps = dependencies();

    await expect(
      deps.service.create(receptionist, { categoryId: 1 }),
    ).rejects.toMatchObject({ code: "CUSTOMER_ID_REQUIRED" });

    deps.repository.findCustomer.mockResolvedValue({ id: 2, status: "INACTIVE" });
    await expect(
      deps.service.create(receptionist, { customerId: 2, categoryId: 1 }),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_ACTIVE" });
  });

  it("rejects inactive catalog references", async () => {
    const deps = dependencies();
    deps.repository.findCustomer.mockResolvedValue({ id: 2, status: "ACTIVE" });
    deps.repository.findActiveCategory.mockResolvedValue(null);

    await expect(
      deps.service.create(customer, { categoryId: 99 }),
    ).rejects.toMatchObject({ code: "DEVICE_CATEGORY_NOT_FOUND" });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("soft-deletes only an owned device", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());

    await deps.service.delete(customer, 10);

    expect(deps.repository.softDelete).toHaveBeenCalledWith(connection, 10);

    deps.repository.findById.mockResolvedValue(row({ customer_id: 3 }));
    await expect(deps.service.delete(customer, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
