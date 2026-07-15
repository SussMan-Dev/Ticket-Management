import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { ImageStorage } from "../src/common/services/image-storage.service.js";
import type { AuthRepository } from "../src/modules/auth/auth.repository.js";
import type { UserRow } from "../src/modules/users/user.model.js";
import type { UserRepository } from "../src/modules/users/user.repository.js";
import { UserService } from "../src/modules/users/user.service.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const admin = {
  id: 1,
  email: "admin@example.com",
  role: "ADMIN" as const,
  sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
};

function row(overrides: Record<string, unknown> = {}): UserRow {
  const now = new Date();
  return {
    id: 2,
    role_id: 2,
    full_name: "Staff User",
    email: "staff@example.com",
    phone: null,
    status: "ACTIVE",
    avatar_url: null,
    role: "TECHNICIAN",
    last_login_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as UserRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findRole: vi.fn(),
    findIdentityConflicts: vi.fn(),
    create: vi.fn(),
    updateProfile: vi.fn(),
    phoneUsedByAnotherUser: vi.fn(),
    updateStatus: vi.fn(),
    updateRole: vi.fn(),
    findActiveAdminIdsForUpdate: vi.fn(),
    findByEmailForUpdate: vi.fn(),
  };
  const sessions = { revokeAllSessions: vi.fn() };
  const auditLogs = { create: vi.fn() };
  const images = { storeAvatar: vi.fn(), deleteByUrl: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new UserService(
    repository as unknown as UserRepository,
    sessions as unknown as AuthRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
    images as unknown as ImageStorage,
  );

  return { service, repository, sessions, auditLogs, images, transaction };
}

describe("UserService", () => {
  it("maps paginated users without credential fields", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [row()], total: 1 });

    const result = await deps.service.list({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.users[0]).not.toHaveProperty("password_hash");
  });

  it("allows self profile update and blocks cross-user update", async () => {
    const deps = dependencies();
    const customer = { ...admin, id: 2, role: "CUSTOMER" as const };
    deps.repository.findById.mockResolvedValueOnce(row()).mockResolvedValueOnce(
      row({ full_name: "Updated Name" }),
    );
    deps.repository.updateProfile.mockResolvedValue(undefined);

    await expect(
      deps.service.update(customer, 2, { fullName: "Updated Name" }, metadata),
    ).resolves.toMatchObject({ fullName: "Updated Name" });
    await expect(
      deps.service.update(customer, 3, { fullName: "Other User" }, metadata),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores a validated self avatar, audits it, and removes the previous managed image", async () => {
    const deps = dependencies();
    const customer = { ...admin, id: 2, role: "CUSTOMER" as const };
    const previousUrl = "http://localhost:3000/uploads/avatars/user-2-old.png";
    const nextUrl = "http://localhost:3000/uploads/avatars/user-2-next.png";
    deps.images.storeAvatar.mockResolvedValue({ url: nextUrl });
    deps.repository.findById
      .mockResolvedValueOnce(row({ avatar_url: previousUrl }))
      .mockResolvedValueOnce(row({ avatar_url: nextUrl }));

    await expect(
      deps.service.updateAvatar(
        customer,
        2,
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        "image/png",
        metadata,
      ),
    ).resolves.toMatchObject({ avatarUrl: nextUrl });

    expect(deps.repository.updateProfile).toHaveBeenCalledWith(
      connection,
      2,
      { avatarUrl: nextUrl },
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "USER_AVATAR_UPDATED" }),
    );
    expect(deps.images.deleteByUrl).toHaveBeenCalledWith(previousUrl);
  });

  it("blocks cross-user avatar writes before storing a file", async () => {
    const deps = dependencies();
    const customer = { ...admin, id: 2, role: "CUSTOMER" as const };

    await expect(
      deps.service.updateAvatar(customer, 3, Buffer.from([1]), "image/png", metadata),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deps.images.storeAvatar).not.toHaveBeenCalled();
  });

  it("creates staff with a hash and audit log", async () => {
    const deps = dependencies();
    deps.repository.findRole.mockResolvedValue({ id: 2, code: "TECHNICIAN" });
    deps.repository.findIdentityConflicts.mockResolvedValue({
      emailExists: false,
      phoneExists: false,
    });
    deps.repository.create.mockResolvedValue(2);
    deps.repository.findById.mockResolvedValue(row());

    const created = await deps.service.createStaff(
      admin,
      {
        fullName: "Staff User",
        email: "staff@example.com",
        password: "Password123",
        role: "TECHNICIAN",
      },
      metadata,
    );

    expect(created.role).toBe("TECHNICIAN");
    const createInput = deps.repository.create.mock.calls[0]?.[1];
    expect(createInput.passwordHash).not.toBe("Password123");
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "STAFF_USER_CREATED" }),
    );
  });

  it("revokes sessions when an administrator disables a user", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValueOnce(row()).mockResolvedValueOnce(
      row({ status: "INACTIVE" }),
    );
    deps.sessions.revokeAllSessions.mockResolvedValue(2);

    const updated = await deps.service.updateStatus(admin, 2, "INACTIVE", metadata);

    expect(updated.status).toBe("INACTIVE");
    expect(deps.sessions.revokeAllSessions).toHaveBeenCalledWith(connection, 2);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "USER_STATUS_CHANGED" }),
    );
  });

  it("protects the last active administrator", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(
      row({ id: 2, role: "ADMIN", role_id: 4, status: "ACTIVE" }),
    );
    deps.repository.findActiveAdminIdsForUpdate.mockResolvedValue([2]);

    await expect(
      deps.service.updateStatus(admin, 2, "INACTIVE", metadata),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_ADMIN" });
    expect(deps.repository.updateStatus).not.toHaveBeenCalled();
  });

  it("prevents an administrator from disabling or demoting itself", async () => {
    const deps = dependencies();

    await expect(
      deps.service.updateStatus(admin, 1, "LOCKED", metadata),
    ).rejects.toMatchObject({ code: "CANNOT_DISABLE_SELF" });

    deps.repository.findById.mockResolvedValue(
      row({ id: 1, role: "ADMIN", role_id: 4 }),
    );
    await expect(
      deps.service.updateRole(admin, 1, "MANAGER", metadata),
    ).rejects.toMatchObject({ code: "CANNOT_MODIFY_SELF_ROLE" });
  });

  it("revokes all target sessions after a role change", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValueOnce(row()).mockResolvedValueOnce(
      row({ role: "MANAGER", role_id: 3 }),
    );
    deps.repository.findRole.mockResolvedValue({ id: 3, code: "MANAGER" });
    deps.sessions.revokeAllSessions.mockResolvedValue(1);

    const updated = await deps.service.updateRole(admin, 2, "MANAGER", metadata);

    expect(updated.role).toBe("MANAGER");
    expect(deps.sessions.revokeAllSessions).toHaveBeenCalledWith(connection, 2);
  });

  it("keeps admin seeding idempotent without replacing an existing password", async () => {
    const deps = dependencies();
    deps.repository.findRole.mockResolvedValue({ id: 4, code: "ADMIN" });
    deps.repository.findByEmailForUpdate.mockResolvedValue(
      row({ id: 1, role: "ADMIN", role_id: 4, email: "admin@example.com" }),
    );

    const result = await deps.service.seedAdmin({
      fullName: "Initial Admin",
      email: "admin@example.com",
      password: "Password123",
    });

    expect(result.created).toBe(false);
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
});
