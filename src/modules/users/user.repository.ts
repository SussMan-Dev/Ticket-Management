import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { UserRole } from "../../common/constants/roles.js";
import { pool } from "../../config/database.js";
import type {
  CreateStaffDto,
  ListUsersQuery,
  UpdateUserDto,
} from "./user.dto.js";
import type { RoleRow, UserAccountStatus, UserRow } from "./user.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface IdentityConflictRow extends RowDataPacket {
  email_exists: number;
  phone_exists: number;
}

interface ExistsRow extends RowDataPacket {
  exists_value: number;
}

export interface CreateUserRecord extends Omit<CreateStaffDto, "password"> {
  roleId: number;
  passwordHash: string;
}

export interface UserListRowsResult {
  rows: UserRow[];
  total: number;
}

const safeUserColumns = `
  u.id,
  u.role_id,
  u.full_name,
  u.email,
  u.phone,
  u.status,
  u.avatar_url,
  r.code AS role,
  u.last_login_at,
  u.created_at,
  u.updated_at
`;

export class UserRepository {
  public async list(query: ListUsersQuery): Promise<UserListRowsResult> {
    const conditions = ["u.deleted_at IS NULL"];
    const params: SqlValue[] = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      params.push(search, search, search);
    }

    if (query.role) {
      conditions.push("r.code = ?");
      params.push(query.role);
    }

    if (query.status) {
      conditions.push("u.status = ?");
      params.push(query.status);
    }

    const whereClause = conditions.join(" AND ");
    const sortColumns: Record<ListUsersQuery["sortBy"], string> = {
      createdAt: "u.created_at",
      fullName: "u.full_name",
      email: "u.email",
      status: "u.status",
      role: "r.code",
    };
    const sortDirection = query.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (query.page - 1) * query.limit;

    const [rows] = await pool.execute<UserRow[]>(
      `
        SELECT ${safeUserColumns}
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE ${whereClause}
        ORDER BY ${sortColumns[query.sortBy]} ${sortDirection}, u.id ${sortDirection}
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `
        SELECT COUNT(u.id) AS total
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE ${whereClause}
      `,
      params,
    );

    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    userId: number,
    lockForUpdate = false,
  ): Promise<UserRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<UserRow[]>(
      `
        SELECT ${safeUserColumns}
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.id = ?
          AND u.deleted_at IS NULL
        LIMIT 1
        ${lockingClause}
      `,
      [userId],
    );

    return rows[0] ?? null;
  }

  public async findByEmailForUpdate(
    connection: PoolConnection,
    email: string,
  ): Promise<UserRow | null> {
    const [rows] = await connection.execute<UserRow[]>(
      `
        SELECT ${safeUserColumns}
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.email = ?
        LIMIT 1
        FOR UPDATE
      `,
      [email],
    );

    return rows[0] ?? null;
  }

  public async findRole(
    executor: DatabaseExecutor,
    role: UserRole,
  ): Promise<RoleRow | null> {
    const [rows] = await executor.execute<RoleRow[]>(
      `
        SELECT id, code
        FROM roles
        WHERE code = ?
        LIMIT 1
      `,
      [role],
    );

    return rows[0] ?? null;
  }

  public async findIdentityConflicts(
    executor: DatabaseExecutor,
    email: string,
    phone: string | null,
  ): Promise<{ emailExists: boolean; phoneExists: boolean }> {
    const [rows] = await executor.execute<IdentityConflictRow[]>(
      `
        SELECT
          EXISTS(SELECT 1 FROM users WHERE email = ?) AS email_exists,
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

  public async phoneUsedByAnotherUser(
    executor: DatabaseExecutor,
    phone: string,
    userId: number,
  ): Promise<boolean> {
    const [rows] = await executor.execute<ExistsRow[]>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM users
          WHERE phone = ?
            AND id <> ?
        ) AS exists_value
      `,
      [phone, userId],
    );

    return Boolean(rows[0]?.exists_value);
  }

  public async create(
    connection: PoolConnection,
    input: CreateUserRecord,
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
      [input.roleId, input.fullName, input.email, input.phone ?? null, input.passwordHash],
    );

    return result.insertId;
  }

  public async updateProfile(
    connection: PoolConnection,
    userId: number,
    input: UpdateUserDto,
  ): Promise<void> {
    const assignments: string[] = [];
    const params: SqlValue[] = [];

    if (input.fullName !== undefined) {
      assignments.push("full_name = ?");
      params.push(input.fullName);
    }

    if (input.phone !== undefined) {
      assignments.push("phone = ?");
      params.push(input.phone);
    }

    if (input.avatarUrl !== undefined) {
      assignments.push("avatar_url = ?");
      params.push(input.avatarUrl);
    }

    params.push(userId);
    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET ${assignments.join(", ")}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      params,
    );
  }

  public async updateStatus(
    connection: PoolConnection,
    userId: number,
    status: UserAccountStatus,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          status = ?,
          failed_login_attempts = CASE WHEN ? = 'ACTIVE' THEN 0 ELSE failed_login_attempts END,
          locked_until = CASE WHEN ? = 'ACTIVE' THEN NULL ELSE locked_until END
        WHERE id = ?
      `,
      [status, status, status, userId],
    );
  }

  public async updateRole(
    connection: PoolConnection,
    userId: number,
    roleId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET role_id = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [roleId, userId],
    );
  }

  public async findActiveAdminIdsForUpdate(
    connection: PoolConnection,
  ): Promise<number[]> {
    const [rows] = await connection.execute<IdRow[]>(
      `
        SELECT u.id
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE r.code = 'ADMIN'
          AND u.status = 'ACTIVE'
          AND u.deleted_at IS NULL
        FOR UPDATE
      `,
    );

    return rows.map((row) => row.id);
  }
}

export const userRepository = new UserRepository();
