import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import {
  duplicateEntryField,
  isDuplicateEntryError,
} from "../../common/utils/database-error.util.js";
import {
  JsonWebTokenError,
  signAccessToken,
  signRefreshToken,
  TokenExpiredError,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../common/utils/jwt.util.js";
import {
  comparePassword,
  comparePasswordAgainstDummy,
  hashPassword,
} from "../../common/utils/password.util.js";
import {
  hashRefreshToken,
  refreshTokenHashMatches,
} from "../../common/utils/refresh-token.util.js";
import {
  withTransaction,
} from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  userRepository,
  type UserRepository,
} from "../users/user.repository.js";
import type { SafeUser } from "../users/user.model.js";
import type {
  IssuedAuthentication,
  LoginDto,
  RegisterCustomerDto,
  RequestMetadata,
} from "./auth.dto.js";
import type {
  AccessTokenPayload,
  AuthenticationUserRow,
  RefreshSessionRow,
} from "./auth.model.js";
import {
  authRepository,
  type AuthRepository,
} from "./auth.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

type LoginOutcome =
  | { kind: "success"; authentication: IssuedAuthentication }
  | { kind: "failure" };

type RefreshOutcome =
  | { kind: "success"; authentication: IssuedAuthentication }
  | { kind: "reuse" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

function safeUserFromAuthenticationRow(
  row: AuthenticationUserRow,
  lastLoginAt = row.last_login_at,
): SafeUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatar_url,
    lastLoginAt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeUserFromRefreshSession(row: RefreshSessionRow): SafeUser {
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.user_status,
    avatarUrl: row.avatar_url,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unavailableForAuthentication(user: AuthenticationUserRow, now: Date): boolean {
  return (
    user.status !== "ACTIVE" ||
    user.deleted_at !== null ||
    (user.locked_until !== null && user.locked_until.getTime() > now.getTime())
  );
}

function createAuthentication(
  user: SafeUser,
  sessionId: string,
): IssuedAuthentication {
  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    sessionId,
  });
  const refresh = signRefreshToken({
    sub: user.id,
    sessionId,
    type: "refresh",
  });

  return {
    data: {
      user,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
    },
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class AuthService {
  public constructor(
    private readonly repository: AuthRepository = authRepository,
    private readonly users: UserRepository = userRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async register(
    input: RegisterCustomerDto,
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    const passwordHash = await hashPassword(input.password);
    const requestMetadata = normalizeMetadata(metadata);

    try {
      return await this.runInTransaction(async (connection) => {
        const roleId = await this.repository.findRoleId(connection, "CUSTOMER");

        if (roleId === null) {
          throw new NotFoundError("Customer role is not configured", "ROLE_NOT_FOUND");
        }

        const conflicts = await this.repository.findIdentityConflicts(
          connection,
          input.email,
          input.phone ?? null,
        );

        if (conflicts.emailExists) {
          throw new ConflictError("Email is already in use", "EMAIL_ALREADY_EXISTS");
        }

        if (conflicts.phoneExists) {
          throw new ConflictError("Phone is already in use", "PHONE_ALREADY_EXISTS");
        }

        const userId = await this.repository.createCustomerUser(connection, {
          roleId,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash,
        });
        await this.repository.createCustomerProfile(
          connection,
          userId,
          input.address ?? null,
        );
        await this.auditLogs.create(connection, {
          userId,
          action: "CUSTOMER_REGISTERED",
          entityType: "USER",
          entityId: userId,
          newData: { email: input.email, role: "CUSTOMER" },
          ...requestMetadata,
        });
        const created = await this.users.findById(connection, userId);

        if (!created) {
          throw new NotFoundError("Created user could not be loaded", "USER_NOT_FOUND");
        }

        return {
          id: created.id,
          fullName: created.full_name,
          email: created.email,
          phone: created.phone,
          role: created.role,
          status: created.status,
          avatarUrl: created.avatar_url,
          lastLoginAt: created.last_login_at,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const field = duplicateEntryField(error);
        throw new ConflictError(
          field === "phone" ? "Phone is already in use" : "Email is already in use",
          field === "phone" ? "PHONE_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS",
        );
      }

      throw error;
    }
  }

  public async login(
    input: LoginDto,
    metadata: RequestMetadata,
  ): Promise<IssuedAuthentication> {
    const requestMetadata = normalizeMetadata(metadata);
    const outcome = await this.runInTransaction<LoginOutcome>(async (connection) => {
      const user = await this.repository.findUserForAuthentication(
        connection,
        input.email,
        true,
      );

      if (!user) {
        await comparePasswordAgainstDummy(input.password);
        return { kind: "failure" };
      }

      const passwordMatches = await comparePassword(input.password, user.password_hash);
      const now = new Date();

      if (unavailableForAuthentication(user, now)) {
        return { kind: "failure" };
      }

      if (!passwordMatches) {
        const previousAttempts =
          user.locked_until && user.locked_until.getTime() <= now.getTime()
            ? 0
            : user.failed_login_attempts;
        const attempts = previousAttempts + 1;
        const lockedUntil =
          attempts >= env.AUTH_MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + env.AUTH_LOCK_DURATION_MINUTES * 60_000)
            : null;
        await this.repository.updateFailedLoginSecurity(
          connection,
          user.id,
          attempts,
          lockedUntil,
        );
        return { kind: "failure" };
      }

      const sessionId = randomUUID();
      const loginTime = new Date();
      const safeUser = safeUserFromAuthenticationRow(user, loginTime);
      const authentication = createAuthentication(safeUser, sessionId);
      await this.repository.recordSuccessfulLogin(connection, user.id);
      await this.repository.createSession(connection, {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashRefreshToken(authentication.refreshToken),
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress,
        expiresAt: authentication.refreshTokenExpiresAt,
      });

      return { kind: "success", authentication };
    });

    if (outcome.kind === "failure") {
      throw new UnauthorizedError("Invalid email or password", "AUTH_INVALID_CREDENTIALS");
    }

    return outcome.authentication;
  }

  public async refresh(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<IssuedAuthentication> {
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError("Refresh token has expired", "AUTH_TOKEN_EXPIRED");
      }

      throw new UnauthorizedError("Refresh token is invalid", "AUTH_TOKEN_INVALID");
    }

    const requestMetadata = normalizeMetadata(metadata);
    const outcome = await this.runInTransaction<RefreshOutcome>(async (connection) => {
      const session = await this.repository.findRefreshSessionForUpdate(
        connection,
        payload.sessionId,
        payload.sub,
      );

      if (!session) {
        return { kind: "invalid" };
      }

      if (
        session.user_status !== "ACTIVE" ||
        session.user_deleted_at !== null ||
        (session.user_locked_until !== null &&
          session.user_locked_until.getTime() > Date.now())
      ) {
        await this.repository.revokeSession(connection, session.session_id);
        return { kind: "unavailable" };
      }

      if (
        session.session_revoked_at !== null ||
        session.session_expires_at.getTime() <= Date.now()
      ) {
        return { kind: "invalid" };
      }

      if (!refreshTokenHashMatches(refreshToken, session.refresh_token_hash)) {
        await this.repository.revokeSession(connection, session.session_id);
        await this.auditLogs.create(connection, {
          userId: session.user_id,
          action: "REFRESH_TOKEN_REUSE_DETECTED",
          entityType: "AUTH_SESSION",
          entityId: session.session_id,
          ...requestMetadata,
        });
        return { kind: "reuse" };
      }

      const authentication = createAuthentication(
        safeUserFromRefreshSession(session),
        session.session_id,
      );
      await this.repository.rotateSession(
        connection,
        session.session_id,
        hashRefreshToken(authentication.refreshToken),
        authentication.refreshTokenExpiresAt,
      );

      return { kind: "success", authentication };
    });

    if (outcome.kind === "reuse") {
      throw new UnauthorizedError("Refresh token is invalid", "AUTH_REFRESH_REUSED");
    }

    if (outcome.kind === "unavailable") {
      throw new UnauthorizedError("Account is unavailable", "AUTH_ACCOUNT_UNAVAILABLE");
    }

    if (outcome.kind === "invalid") {
      throw new UnauthorizedError("Session is invalid", "AUTH_SESSION_REVOKED");
    }

    return outcome.authentication;
  }

  public async authenticate(
    accessToken: string,
    options: { allowRevokedSession?: boolean } = {},
  ): Promise<Express.AuthenticatedUser> {
    let payload: AccessTokenPayload;

    try {
      payload = verifyAccessToken(accessToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError("Access token has expired", "AUTH_TOKEN_EXPIRED");
      }

      if (error instanceof JsonWebTokenError || error instanceof Error) {
        throw new UnauthorizedError("Access token is invalid", "AUTH_TOKEN_INVALID");
      }

      throw error;
    }

    const context = await this.repository.findAuthenticationContext(
      pool,
      payload.sessionId,
      payload.sub,
    );

    if (
      !context ||
      (context.session_revoked_at !== null && !options.allowRevokedSession)
    ) {
      throw new UnauthorizedError("Session has been revoked", "AUTH_SESSION_REVOKED");
    }

    if (context.session_expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedError("Session has expired", "AUTH_SESSION_EXPIRED");
    }

    if (
      context.user_status !== "ACTIVE" ||
      context.user_deleted_at !== null ||
      (context.user_locked_until !== null && context.user_locked_until.getTime() > Date.now())
    ) {
      throw new UnauthorizedError("Account is unavailable", "AUTH_ACCOUNT_UNAVAILABLE");
    }

    if (context.role !== payload.role || context.email !== payload.email) {
      throw new UnauthorizedError("Session identity has changed", "AUTH_SESSION_REVOKED");
    }

    return {
      id: context.user_id,
      email: context.email,
      role: context.role,
      sessionId: context.session_id,
    };
  }

  public async logout(
    user: Express.AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<void> {
    const requestMetadata = normalizeMetadata(metadata);
    await this.runInTransaction(async (connection) => {
      await this.repository.revokeSession(connection, user.sessionId, user.id);
      await this.auditLogs.create(connection, {
        userId: user.id,
        action: "AUTH_SESSION_LOGOUT",
        entityType: "AUTH_SESSION",
        entityId: user.sessionId,
        ...requestMetadata,
      });
    });
  }

  public async logoutAll(
    user: Express.AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<number> {
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const revokedSessions = await this.repository.revokeAllSessions(connection, user.id);
      await this.auditLogs.create(connection, {
        userId: user.id,
        action: "AUTH_ALL_SESSIONS_LOGOUT",
        entityType: "USER",
        entityId: user.id,
        newData: { revokedSessions },
        ...requestMetadata,
      });
      return revokedSessions;
    });
  }

  public async getMe(userId: number): Promise<SafeUser> {
    const user = await this.users.findById(pool, userId);

    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatar_url,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}

export const authService = new AuthService();
