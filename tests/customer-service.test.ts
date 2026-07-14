import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { CustomerRow } from "../src/modules/customers/customer.model.js";
import type { CustomerRepository } from "../src/modules/customers/customer.repository.js";
import { CustomerService } from "../src/modules/customers/customer.service.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const receptionist = {
  id: 1,
  email: "receptionist@example.com",
  role: "RECEPTIONIST" as const,
  sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
};
const customerActor = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "2c7063b2-cd1e-4f65-a4a1-28c1ab59b1c6",
};

function row(overrides: Record<string, unknown> = {}): CustomerRow {
  const now = new Date();
  return {
    id: 2,
    full_name: "Customer User",
    email: "customer@example.com",
    phone: null,
    status: "ACTIVE",
    avatar_url: null,
    address: "Bangkok",
    notes: "Staff-only note",
    created_at: now,
    updated_at: now,
    ...overrides,
  } as CustomerRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findCustomerRoleId: vi.fn(),
    findIdentityConflicts: vi.fn(),
    phoneUsedByAnotherUser: vi.fn(),
    createUser: vi.fn(),
    createProfile: vi.fn(),
    update: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new CustomerService(
    repository as unknown as CustomerRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );

  return { service, repository, auditLogs, transaction };
}

describe("CustomerService", () => {
  it("returns minimal customer list data without staff notes", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [row()], total: 1 });

    const result = await deps.service.list({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.customers[0]).not.toHaveProperty("notes");
    expect(result.customers[0]).not.toHaveProperty("address");
  });

  it("allows self access, hides notes, and blocks another customer", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());

    await expect(deps.service.getById(customerActor, 2)).resolves.not.toHaveProperty(
      "notes",
    );
    await expect(deps.service.getById(customerActor, 3)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("shows staff notes to authorized intake staff", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());

    await expect(deps.service.getById(receptionist, 2)).resolves.toMatchObject({
      notes: "Staff-only note",
    });
  });

  it("creates the user and profile atomically with a hashed password", async () => {
    const deps = dependencies();
    deps.repository.findCustomerRoleId.mockResolvedValue(7);
    deps.repository.findIdentityConflicts.mockResolvedValue({
      emailExists: false,
      phoneExists: false,
    });
    deps.repository.createUser.mockResolvedValue(2);
    deps.repository.findById.mockResolvedValue(row());

    const created = await deps.service.create(
      receptionist,
      {
        fullName: "Customer User",
        email: "customer@example.com",
        password: "Password123",
        address: "Bangkok",
        notes: "Staff-only note",
      },
      metadata,
    );

    expect(created.id).toBe(2);
    expect(deps.transaction).toHaveBeenCalledOnce();
    expect(deps.repository.createProfile).toHaveBeenCalledWith(
      connection,
      2,
      "Bangkok",
      "Staff-only note",
    );
    const createInput = deps.repository.createUser.mock.calls[0]?.[1];
    expect(createInput.passwordHash).not.toBe("Password123");
    expect(createInput).not.toHaveProperty("password");
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "CUSTOMER_CREATED_BY_STAFF" }),
    );
  });

  it("prevents customers from writing staff-only notes", async () => {
    const deps = dependencies();

    await expect(
      deps.service.update(customerActor, 2, { notes: "overwrite" }, metadata),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOTES_FORBIDDEN" });
    expect(deps.transaction).not.toHaveBeenCalled();
  });

  it("updates own contact/profile fields in one transaction", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ address: "Chiang Mai" }));

    const updated = await deps.service.update(
      customerActor,
      2,
      { address: "Chiang Mai" },
      metadata,
    );

    expect(updated.address).toBe("Chiang Mai");
    expect(updated).not.toHaveProperty("notes");
    expect(deps.repository.update).toHaveBeenCalledWith(connection, 2, {
      address: "Chiang Mai",
    });
  });
});
