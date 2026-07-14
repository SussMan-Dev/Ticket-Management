import type { PoolConnection } from "mysql2/promise";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import { hashPassword } from "../src/common/utils/password.util.js";
import { hashRefreshToken } from "../src/common/utils/refresh-token.util.js";
import { signRefreshToken } from "../src/common/utils/jwt.util.js";
import { signAccessToken } from "../src/common/utils/jwt.util.js";
import type { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import type { AuthenticationUserRow, RefreshSessionRow } from "../src/modules/auth/auth.model.js";
import type { UserRepository } from "../src/modules/users/user.repository.js";
import type { UserRow } from "../src/modules/users/user.model.js";

const connection = {} as PoolConnection;
const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };

function userRow(overrides: Record<string, unknown> = {}): AuthenticationUserRow {
  const now = new Date();
  return {
    id: 1,
    role_id: 1,
    full_name: "Customer User",
    email: "customer@example.com",
    phone: null,
    password_hash: "",
    status: "ACTIVE",
    avatar_url: null,
    role: "CUSTOMER",
    last_login_at: null,
    failed_login_attempts: 0,
    locked_until: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  } as AuthenticationUserRow;
}

function safeRow(): UserRow {
  const now = new Date();
  return {
    id: 1,
    role_id: 1,
    full_name: "Customer User",
    email: "customer@example.com",
    phone: null,
    status: "ACTIVE",
    avatar_url: null,
    role: "CUSTOMER",
    last_login_at: null,
    created_at: now,
    updated_at: now,
  } as UserRow;
}

function dependencies() {
  const repository = {
    findRoleId: vi.fn(),
    findIdentityConflicts: vi.fn(),
    createCustomerUser: vi.fn(),
    createCustomerProfile: vi.fn(),
    findUserForAuthentication: vi.fn(),
    updateFailedLoginSecurity: vi.fn(),
    recordSuccessfulLogin: vi.fn(),
    createSession: vi.fn(),
    findRefreshSessionForUpdate: vi.fn(),
    rotateSession: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
    findAuthenticationContext: vi.fn(),
  };
  const users = { findById: vi.fn() };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new AuthService(
    repository as unknown as AuthRepository,
    users as unknown as UserRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );

  return { service, repository, users, auditLogs, transaction };
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a CUSTOMER and profile atomically without passing plaintext password", async () => {
    const deps = dependencies();
    deps.repository.findRoleId.mockResolvedValue(1);
    deps.repository.findIdentityConflicts.mockResolvedValue({
      emailExists: false,
      phoneExists: false,
    });
    deps.repository.createCustomerUser.mockResolvedValue(1);
    deps.repository.createCustomerProfile.mockResolvedValue(undefined);
    deps.auditLogs.create.mockResolvedValue(1);
    deps.users.findById.mockResolvedValue(safeRow());

    const user = await deps.service.register(
      {
        fullName: "Customer User",
        email: "customer@example.com",
        password: "Password123",
      },
      metadata,
    );

    expect(user.role).toBe("CUSTOMER");
    const createInput = deps.repository.createCustomerUser.mock.calls[0]?.[1];
    expect(createInput.passwordHash).not.toBe("Password123");
    expect(deps.repository.createCustomerProfile).toHaveBeenCalledWith(connection, 1, null);
    expect(deps.transaction).toHaveBeenCalledOnce();
  });

  it("rejects duplicate registration identities", async () => {
    const deps = dependencies();
    deps.repository.findRoleId.mockResolvedValue(1);
    deps.repository.findIdentityConflicts.mockResolvedValue({
      emailExists: true,
      phoneExists: false,
    });

    await expect(
      deps.service.register(
        {
          fullName: "Customer User",
          email: "customer@example.com",
          password: "Password123",
        },
        metadata,
      ),
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
    expect(deps.repository.createCustomerUser).not.toHaveBeenCalled();
  });

  it("propagates profile creation failure so the transaction runner can roll back", async () => {
    const deps = dependencies();
    deps.repository.findRoleId.mockResolvedValue(1);
    deps.repository.findIdentityConflicts.mockResolvedValue({
      emailExists: false,
      phoneExists: false,
    });
    deps.repository.createCustomerUser.mockResolvedValue(1);
    deps.repository.createCustomerProfile.mockRejectedValue(new Error("profile failed"));

    await expect(
      deps.service.register(
        {
          fullName: "Customer User",
          email: "customer@example.com",
          password: "Password123",
        },
        metadata,
      ),
    ).rejects.toThrow("profile failed");
  });

  it("creates a hashed refresh session and resets login security after valid login", async () => {
    const deps = dependencies();
    const passwordHash = await hashPassword("Password123");
    deps.repository.findUserForAuthentication.mockResolvedValue(
      userRow({ password_hash: passwordHash }),
    );

    const authentication = await deps.service.login(
      { email: "customer@example.com", password: "Password123" },
      metadata,
    );

    expect(authentication.data.accessToken).toBeTruthy();
    expect(deps.repository.recordSuccessfulLogin).toHaveBeenCalledWith(connection, 1);
    const sessionInput = deps.repository.createSession.mock.calls[0]?.[1];
    expect(sessionInput.refreshTokenHash).toHaveLength(64);
    expect(sessionInput.refreshTokenHash).not.toBe(authentication.refreshToken);
  });

  it("uses a generic login error and increments failed attempts", async () => {
    const deps = dependencies();
    const passwordHash = await hashPassword("Password123");
    deps.repository.findUserForAuthentication.mockResolvedValue(
      userRow({ password_hash: passwordHash, failed_login_attempts: 4 }),
    );

    await expect(
      deps.service.login(
        { email: "customer@example.com", password: "WrongPassword123" },
        metadata,
      ),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
    const update = deps.repository.updateFailedLoginSecurity.mock.calls[0];
    expect(update?.[2]).toBe(5);
    expect(update?.[3]).toBeInstanceOf(Date);
    expect(deps.repository.createSession).not.toHaveBeenCalled();
  });

  it("does not create sessions for administratively unavailable accounts", async () => {
    const deps = dependencies();
    const passwordHash = await hashPassword("Password123");
    deps.repository.findUserForAuthentication.mockResolvedValue(
      userRow({ password_hash: passwordHash, status: "LOCKED" }),
    );

    await expect(
      deps.service.login(
        { email: "customer@example.com", password: "Password123" },
        metadata,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    expect(deps.repository.createSession).not.toHaveBeenCalled();
  });

  it("rotates a valid refresh token and rejects replay of the old token", async () => {
    const deps = dependencies();
    const signed = signRefreshToken({ sub: 1, sessionId, type: "refresh" });
    const session: RefreshSessionRow = {
      session_id: sessionId,
      refresh_token_hash: hashRefreshToken(signed.token),
      session_expires_at: new Date(Date.now() + 60_000),
      session_revoked_at: null,
      user_id: 1,
      full_name: "Customer User",
      email: "customer@example.com",
      phone: null,
      avatar_url: null,
      user_status: "ACTIVE",
      last_login_at: null,
      user_locked_until: null,
      user_deleted_at: null,
      role: "CUSTOMER",
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshSessionRow;
    deps.repository.findRefreshSessionForUpdate.mockResolvedValueOnce(session);

    const rotated = await deps.service.refresh(signed.token, metadata);

    expect(rotated.refreshToken).not.toBe(signed.token);
    expect(deps.repository.rotateSession).toHaveBeenCalledOnce();

    deps.repository.findRefreshSessionForUpdate.mockResolvedValueOnce({
      ...session,
      refresh_token_hash: hashRefreshToken(rotated.refreshToken),
    });
    await expect(deps.service.refresh(signed.token, metadata)).rejects.toMatchObject({
      code: "AUTH_REFRESH_REUSED",
    });
    expect(deps.repository.revokeSession).toHaveBeenCalledWith(connection, sessionId);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "REFRESH_TOKEN_REUSE_DETECTED" }),
    );
  });

  it("revokes one or all sessions through transaction boundaries", async () => {
    const deps = dependencies();
    deps.repository.revokeAllSessions.mockResolvedValue(3);
    const actor = {
      id: 1,
      email: "customer@example.com",
      role: "CUSTOMER" as const,
      sessionId,
    };

    await deps.service.logout(actor, metadata);
    await expect(deps.service.logoutAll(actor, metadata)).resolves.toBe(3);

    expect(deps.repository.revokeSession).toHaveBeenCalledWith(connection, sessionId, 1);
    expect(deps.repository.revokeAllSessions).toHaveBeenCalledWith(connection, 1);
  });

  it("uses current database session context and rejects stale token roles", async () => {
    const deps = dependencies();
    const access = signAccessToken({
      sub: 1,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    deps.repository.findAuthenticationContext.mockResolvedValue({
      session_id: sessionId,
      session_expires_at: new Date(Date.now() + 60_000),
      session_revoked_at: null,
      user_id: 1,
      email: "customer@example.com",
      role: "ADMIN",
      user_status: "ACTIVE",
      user_deleted_at: null,
      user_locked_until: null,
    });

    await expect(deps.service.authenticate(access.token)).rejects.toMatchObject({
      code: "AUTH_SESSION_REVOKED",
    });
  });
});
