import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  ListCustomersQuery,
  UpdateCustomerDto,
} from "./customer.dto.js";
import type { CustomerRow } from "./customer.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

interface RoleRow extends RowDataPacket {
  id: number;
}

interface IdentityConflictRow extends RowDataPacket {
  email_exists: number;
  phone_exists: number;
}

interface ExistsRow extends RowDataPacket {
  exists_value: number;
}

export interface CreateCustomerRecord {
  fullName: string;
  email: string;
  phone?: string;
  roleId: number;
  passwordHash: string;
}

export interface CustomerListRowsResult {
  rows: CustomerRow[];
  total: number;
}

const customerColumns = `
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.status,
  u.avatar_url,
  cp.address,
  cp.notes,
  u.created_at,
  GREATEST(u.updated_at, cp.updated_at) AS updated_at
`;

export class CustomerRepository {
  public async list(query: ListCustomersQuery): Promise<CustomerListRowsResult> {
    const conditions = ["r.code = 'CUSTOMER'", "u.deleted_at IS NULL"];
    const params: SqlValue[] = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      params.push(search, search, search);
    }

    if (query.status) {
      conditions.push("u.status = ?");
      params.push(query.status);
    }

    const whereClause = conditions.join(" AND ");
    const sortColumns: Record<ListCustomersQuery["sortBy"], string> = {
      createdAt: "u.created_at",
      fullName: "u.full_name",
      email: "u.email",
      status: "u.status",
    };
    const sortDirection = query.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (query.page - 1) * query.limit;

    const [rows] = await pool.execute<CustomerRow[]>(
      `
        SELECT ${customerColumns}
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        INNER JOIN customer_profiles AS cp ON cp.user_id = u.id
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
        INNER JOIN customer_profiles AS cp ON cp.user_id = u.id
        WHERE ${whereClause}
      `,
      params,
    );

    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    customerId: number,
    lockForUpdate = false,
  ): Promise<CustomerRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<CustomerRow[]>(
      `
        SELECT ${customerColumns}
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        INNER JOIN customer_profiles AS cp ON cp.user_id = u.id
        WHERE u.id = ?
          AND r.code = 'CUSTOMER'
          AND u.deleted_at IS NULL
        LIMIT 1
        ${lockingClause}
      `,
      [customerId],
    );

    return rows[0] ?? null;
  }

  public async findCustomerRoleId(executor: DatabaseExecutor): Promise<number | null> {
    const [rows] = await executor.execute<RoleRow[]>(
      `
        SELECT id
        FROM roles
        WHERE code = 'CUSTOMER'
        LIMIT 1
      `,
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
    customerId: number,
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
      [phone, customerId],
    );

    return Boolean(rows[0]?.exists_value);
  }

  public async createUser(
    connection: PoolConnection,
    input: CreateCustomerRecord,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO users (role_id, full_name, email, phone, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `,
      [input.roleId, input.fullName, input.email, input.phone ?? null, input.passwordHash],
    );

    return result.insertId;
  }

  public async createProfile(
    connection: PoolConnection,
    customerId: number,
    address: string | null,
    notes: string | null,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO customer_profiles (user_id, address, notes)
        VALUES (?, ?, ?)
      `,
      [customerId, address, notes],
    );
  }

  public async update(
    connection: PoolConnection,
    customerId: number,
    input: UpdateCustomerDto,
  ): Promise<void> {
    const userAssignments: string[] = [];
    const userParams: SqlValue[] = [];

    if (input.fullName !== undefined) {
      userAssignments.push("full_name = ?");
      userParams.push(input.fullName);
    }

    if (input.phone !== undefined) {
      userAssignments.push("phone = ?");
      userParams.push(input.phone);
    }

    if (userAssignments.length > 0) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE users
          SET ${userAssignments.join(", ")}
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [...userParams, customerId],
      );
    }

    const profileAssignments: string[] = [];
    const profileParams: SqlValue[] = [];

    if (input.address !== undefined) {
      profileAssignments.push("address = ?");
      profileParams.push(input.address);
    }

    if (input.notes !== undefined) {
      profileAssignments.push("notes = ?");
      profileParams.push(input.notes);
    }

    if (profileAssignments.length > 0) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE customer_profiles
          SET ${profileAssignments.join(", ")}
          WHERE user_id = ?
        `,
        [...profileParams, customerId],
      );
    }
  }
}

export const customerRepository = new CustomerRepository();
