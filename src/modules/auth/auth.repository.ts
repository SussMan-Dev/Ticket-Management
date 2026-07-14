import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { UserRole } from "../../common/constants/roles.js";
import type { UserAccountStatus } from "../users/user.model.js";
import type {
  AuthenticationContextRow,
  AuthenticationUserRow,
  RefreshSessionRow,
} from "./auth.model.js";

type DatabaseExecutor = Pool | PoolConnection;

interface IdentityConflictRow extends RowDataPacket {
  email_exists: number;
  phone_exists: number;
}

interface RoleIdRow extends RowDataPacket {
  id: number;
}

export interface CreateCustomerUserInput {
  roleId: number;
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}

export interface CreateSessionInput {
  id: string;
  userId: number;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

export class AuthRepository {
  public async findRoleId(
    executor: DatabaseExecutor,
    role: UserRole,
  ): Promise<number | null> {
    const [rows] = await executor.execute<RoleIdRow[]>(
      `
        SELECT id
        FROM roles
        WHERE code = ?
        LIMIT 1
      `,
      [role],
    );

    return rows[0]?.id ?? null;
  }

  public async findIdentityConflicts(
    executor: DatabaseExecutor,
    email: string,
    phone: string | null,
  ): Promise<{ emailExists: boolean; phoneExists: boolean }> {
    const [rows] = await executor.execute<IdentityConflictRow[]>(
      `
        SELECT
          EXISTS(
            SELECT 1
            FROM users
            WHERE email = ?
          ) AS email_exists,
          EXISTS(
            SELECT 1
            FROM users
            WHERE phone = ?
              AND ? IS NOT NULL
          ) AS phone_exists
      `,
      [email, phone, phone],
    );
    const row = rows[0];

    return {
      emailExists: Boolean(row?.email_exists),
      phoneExists: Boolean(row?.phone_exists),
    };
  }

  public async createCustomerUser(
    connection: PoolConnection,
    input: CreateCustomerUserInput,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO users (
          role_id,
          full_name,
          email,
          phone,
          password_hash
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [input.roleId, input.fullName, input.email, input.phone, input.passwordHash],
    );

    return result.insertId;
  }

  public async createCustomerProfile(
    connection: PoolConnection,
    userId: number,
    address: string | null,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO customer_profiles (user_id, address)
        VALUES (?, ?)
      `,
      [userId, address],
    );
  }

  public async findUserForAuthentication(
    executor: DatabaseExecutor,
    email: string,
    lockForUpdate = false,
  ): Promise<AuthenticationUserRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<AuthenticationUserRow[]>(
      `
        SELECT
          u.id,
          u.role_id,
          u.full_name,
          u.email,
          u.phone,
          u.password_hash,
          u.status,
          u.avatar_url,
          r.code AS role,
          u.last_login_at,
          u.failed_login_attempts,
          u.locked_until,
          u.created_at,
          u.updated_at,
          u.deleted_at
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.email = ?
        LIMIT 1
        ${lockingClause}
      `,
      [email],
    );

    return rows[0] ?? null;
  }

  public async updateFailedLoginSecurity(
    connection: PoolConnection,
    userId: number,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          failed_login_attempts = ?,
          locked_until = ?
        WHERE id = ?
      `,
      [attempts, lockedUntil, userId],
    );
  }

  public async recordSuccessfulLogin(
    connection: PoolConnection,
    userId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [userId],
    );
  }

  public async createSession(
    connection: PoolConnection,
    input: CreateSessionInput,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO auth_sessions (
          id,
          user_id,
          refresh_token_hash,
          user_agent,
          ip_address,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        input.id,
        input.userId,
        input.refreshTokenHash,
        input.userAgent,
        input.ipAddress,
        input.expiresAt,
      ],
    );
  }

  public async findAuthenticationContext(
    executor: DatabaseExecutor,
    sessionId: string,
    userId: number,
  ): Promise<AuthenticationContextRow | null> {
    const [rows] = await executor.execute<AuthenticationContextRow[]>(
      `
        SELECT
          s.id AS session_id,
          s.expires_at AS session_expires_at,
          s.revoked_at AS session_revoked_at,
          u.id AS user_id,
          u.email,
          r.code AS role,
          u.status AS user_status,
          u.deleted_at AS user_deleted_at,
          u.locked_until AS user_locked_until
        FROM auth_sessions AS s
        INNER JOIN users AS u ON u.id = s.user_id
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE s.id = ?
          AND s.user_id = ?
        LIMIT 1
      `,
      [sessionId, userId],
    );

    return rows[0] ?? null;
  }

  public async findRefreshSessionForUpdate(
    connection: PoolConnection,
    sessionId: string,
    userId: number,
  ): Promise<RefreshSessionRow | null> {
    const [rows] = await connection.execute<RefreshSessionRow[]>(
      `
        SELECT
          s.id AS session_id,
          s.refresh_token_hash,
          s.expires_at AS session_expires_at,
          s.revoked_at AS session_revoked_at,
          u.id AS user_id,
          u.full_name,
          u.email,
          u.phone,
          u.avatar_url,
          u.status AS user_status,
          u.last_login_at,
          u.locked_until AS user_locked_until,
          u.deleted_at AS user_deleted_at,
          u.created_at,
          u.updated_at,
          r.code AS role
        FROM auth_sessions AS s
        INNER JOIN users AS u ON u.id = s.user_id
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE s.id = ?
          AND s.user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [sessionId, userId],
    );

    return rows[0] ?? null;
  }

  public async rotateSession(
    connection: PoolConnection,
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE auth_sessions
        SET
          refresh_token_hash = ?,
          expires_at = ?,
          revoked_at = NULL
        WHERE id = ?
      `,
      [refreshTokenHash, expiresAt, sessionId],
    );
  }

  public async revokeSession(
    connection: PoolConnection,
    sessionId: string,
    userId?: number,
  ): Promise<void> {
    const userCondition = userId === undefined ? "" : "AND user_id = ?";
    const params = userId === undefined ? [sessionId] : [sessionId, userId];

    await connection.execute<ResultSetHeader>(
      `
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP())
        WHERE id = ?
          ${userCondition}
      `,
      params,
    );
  }

  public async revokeAllSessions(
    connection: PoolConnection,
    userId: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE auth_sessions
        SET revoked_at = UTC_TIMESTAMP()
        WHERE user_id = ?
          AND revoked_at IS NULL
      `,
      [userId],
    );

    return result.affectedRows;
  }
}

export const authRepository = new AuthRepository();
