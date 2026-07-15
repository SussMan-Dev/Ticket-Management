import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  CreateDeviceDto,
  ListDevicesQuery,
  UpdateDeviceDto,
} from "./device.dto.js";
import type {
  CatalogRow,
  DeviceCustomerRow,
  DeviceRow,
} from "./device.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

export interface DeviceListRowsResult {
  rows: DeviceRow[];
  total: number;
}

export interface CreateDeviceRecord extends Omit<CreateDeviceDto, "customerId"> {
  customerId: number;
}

const deviceColumns = `
  d.id,
  d.customer_id,
  u.full_name AS customer_name,
  d.category_id,
  dc.name AS category_name,
  d.brand_id,
  db.name AS brand_name,
  d.model,
  d.serial_number,
  d.imei,
  d.color,
  d.description,
  d.created_at,
  d.updated_at
`;

export class DeviceRepository {
  public async list(query: ListDevicesQuery): Promise<DeviceListRowsResult> {
    const conditions = ["d.deleted_at IS NULL", "u.deleted_at IS NULL"];
    const params: SqlValue[] = [];

    if (query.customerId !== undefined) {
      conditions.push("d.customer_id = ?");
      params.push(query.customerId);
    }

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push("(d.model LIKE ? OR d.serial_number LIKE ? OR d.imei LIKE ?)");
      params.push(search, search, search);
    }

    const whereClause = conditions.join(" AND ");
    const sortColumns: Record<ListDevicesQuery["sortBy"], string> = {
      createdAt: "d.created_at",
      updatedAt: "d.updated_at",
      model: "d.model",
    };
    const sortDirection = query.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (query.page - 1) * query.limit;

    // LIMIT/OFFSET placeholders are incompatible with prepared statements on
    // some supported MySQL deployments; query() still escapes all parameters.
    const [rows] = await pool.query<DeviceRow[]>(
      `
        SELECT ${deviceColumns}
        FROM devices AS d
        INNER JOIN users AS u ON u.id = d.customer_id
        INNER JOIN device_categories AS dc ON dc.id = d.category_id
        LEFT JOIN device_brands AS db ON db.id = d.brand_id
        WHERE ${whereClause}
        ORDER BY ${sortColumns[query.sortBy]} ${sortDirection}, d.id ${sortDirection}
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `
        SELECT COUNT(d.id) AS total
        FROM devices AS d
        INNER JOIN users AS u ON u.id = d.customer_id
        WHERE ${whereClause}
      `,
      params,
    );

    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    deviceId: number,
    lockForUpdate = false,
  ): Promise<DeviceRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<DeviceRow[]>(
      `
        SELECT ${deviceColumns}
        FROM devices AS d
        INNER JOIN users AS u ON u.id = d.customer_id
        INNER JOIN device_categories AS dc ON dc.id = d.category_id
        LEFT JOIN device_brands AS db ON db.id = d.brand_id
        WHERE d.id = ?
          AND d.deleted_at IS NULL
          AND u.deleted_at IS NULL
        LIMIT 1
        ${lockingClause}
      `,
      [deviceId],
    );

    return rows[0] ?? null;
  }

  public async findCustomer(
    executor: DatabaseExecutor,
    customerId: number,
    lockForUpdate = false,
  ): Promise<DeviceCustomerRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<DeviceCustomerRow[]>(
      `
        SELECT u.id, u.status
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
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

  public async findActiveCategory(
    executor: DatabaseExecutor,
    categoryId: number,
  ): Promise<CatalogRow | null> {
    const [rows] = await executor.execute<CatalogRow[]>(
      `
        SELECT id, name, description, is_active
        FROM device_categories
        WHERE id = ?
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [categoryId],
    );

    return rows[0] ?? null;
  }

  public async findActiveBrand(
    executor: DatabaseExecutor,
    brandId: number,
  ): Promise<CatalogRow | null> {
    const [rows] = await executor.execute<CatalogRow[]>(
      `
        SELECT id, name, is_active
        FROM device_brands
        WHERE id = ?
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [brandId],
    );

    return rows[0] ?? null;
  }

  public async listActiveCategories(): Promise<CatalogRow[]> {
    const [rows] = await pool.execute<CatalogRow[]>(
      `
        SELECT id, name, description, is_active
        FROM device_categories
        WHERE is_active = TRUE
        ORDER BY name ASC, id ASC
      `,
    );

    return rows;
  }

  public async listActiveBrands(): Promise<CatalogRow[]> {
    const [rows] = await pool.execute<CatalogRow[]>(
      `
        SELECT id, name, is_active
        FROM device_brands
        WHERE is_active = TRUE
        ORDER BY name ASC, id ASC
      `,
    );

    return rows;
  }

  public async create(
    connection: PoolConnection,
    input: CreateDeviceRecord,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO devices (
          customer_id,
          category_id,
          brand_id,
          model,
          serial_number,
          imei,
          color,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.customerId,
        input.categoryId,
        input.brandId ?? null,
        input.model ?? null,
        input.serialNumber ?? null,
        input.imei ?? null,
        input.color ?? null,
        input.description ?? null,
      ],
    );

    return result.insertId;
  }

  public async update(
    connection: PoolConnection,
    deviceId: number,
    input: UpdateDeviceDto,
  ): Promise<void> {
    const columnByField: Record<keyof UpdateDeviceDto, string> = {
      categoryId: "category_id",
      brandId: "brand_id",
      model: "model",
      serialNumber: "serial_number",
      imei: "imei",
      color: "color",
      description: "description",
    };
    const assignments: string[] = [];
    const params: SqlValue[] = [];

    for (const field of Object.keys(columnByField) as (keyof UpdateDeviceDto)[]) {
      const value = input[field];

      if (value !== undefined) {
        assignments.push(`${columnByField[field]} = ?`);
        params.push(value);
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE devices
        SET ${assignments.join(", ")}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [...params, deviceId],
    );
  }

  public async softDelete(connection: PoolConnection, deviceId: number): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE devices
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [deviceId],
    );
  }
}

export const deviceRepository = new DeviceRepository();
