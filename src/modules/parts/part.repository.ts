import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  CreatePartDto,
  ListInventoryTransactionsQuery,
  ListPartsQuery,
  UpdatePartDto,
} from "./part.dto.js";
import type {
  InventoryTransactionRow,
  InventoryTransactionType,
  PartRow,
} from "./part.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | boolean | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

export interface PartListRowsResult {
  rows: PartRow[];
  total: number;
}

export interface InventoryTransactionListRowsResult {
  rows: InventoryTransactionRow[];
  total: number;
}

const partColumns = `
  p.id,
  p.sku,
  p.name,
  p.description,
  p.unit,
  p.purchase_price,
  p.selling_price,
  p.quantity_on_hand,
  p.minimum_stock,
  p.is_active,
  p.created_at,
  p.updated_at
`;

export class PartRepository {
  public async list(query: ListPartsQuery): Promise<PartListRowsResult> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push("(p.sku LIKE ? OR p.name LIKE ? OR p.description LIKE ?)");
      params.push(search, search, search);
    }
    if (query.isActive !== undefined) {
      conditions.push("p.is_active = ?");
      params.push(query.isActive);
    }
    if (query.lowStock !== undefined) {
      conditions.push(query.lowStock
        ? "p.quantity_on_hand <= p.minimum_stock"
        : "p.quantity_on_hand > p.minimum_stock");
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const sortColumns: Record<ListPartsQuery["sortBy"], string> = {
      createdAt: "p.created_at",
      sku: "p.sku",
      name: "p.name",
      quantityOnHand: "p.quantity_on_hand",
      sellingPrice: "p.selling_price",
    };
    const direction = query.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (query.page - 1) * query.limit;

    const [rows] = await pool.query<PartRow[]>(
      `
        SELECT ${partColumns}
        FROM parts AS p
        ${whereClause}
        ORDER BY ${sortColumns[query.sortBy]} ${direction}, p.id ${direction}
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(p.id) AS total FROM parts AS p ${whereClause}`,
      params,
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    partId: number,
    lockForUpdate = false,
  ): Promise<PartRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<PartRow[]>(
      `
        SELECT ${partColumns}
        FROM parts AS p
        WHERE p.id = ?
        LIMIT 1
        ${lockingClause}
      `,
      [partId],
    );
    return rows[0] ?? null;
  }

  public async findByIdsForUpdate(
    connection: PoolConnection,
    partIds: number[],
    activeOnly = false,
  ): Promise<PartRow[]> {
    if (partIds.length === 0) return [];
    const sortedIds = [...partIds].sort((a, b) => a - b);
    const placeholders = sortedIds.map(() => "?").join(", ");
    const activeCondition = activeOnly ? "AND p.is_active = TRUE" : "";
    const [rows] = await connection.execute<PartRow[]>(
      `
        SELECT ${partColumns}
        FROM parts AS p
        WHERE p.id IN (${placeholders})
          ${activeCondition}
        ORDER BY p.id ASC
        FOR UPDATE
      `,
      sortedIds,
    );
    return rows;
  }

  public async create(
    connection: PoolConnection,
    input: CreatePartDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO parts (
          sku, name, description, unit, purchase_price, selling_price,
          minimum_stock, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.sku,
        input.name,
        input.description ?? null,
        input.unit,
        input.purchasePrice,
        input.sellingPrice,
        input.minimumStock,
        input.isActive,
      ],
    );
    return result.insertId;
  }

  public async update(
    connection: PoolConnection,
    partId: number,
    input: UpdatePartDto,
  ): Promise<void> {
    const columns: Record<keyof UpdatePartDto, string> = {
      sku: "sku",
      name: "name",
      description: "description",
      unit: "unit",
      purchasePrice: "purchase_price",
      sellingPrice: "selling_price",
      minimumStock: "minimum_stock",
      isActive: "is_active",
    };
    const assignments: string[] = [];
    const params: SqlValue[] = [];
    for (const field of Object.keys(columns) as Array<keyof UpdatePartDto>) {
      if (input[field] !== undefined) {
        assignments.push(`${columns[field]} = ?`);
        params.push(input[field] ?? null);
      }
    }
    if (assignments.length === 0) return;
    await connection.execute<ResultSetHeader>(
      `UPDATE parts SET ${assignments.join(", ")} WHERE id = ?`,
      [...params, partId],
    );
  }

  public async updateStock(
    connection: PoolConnection,
    partId: number,
    quantityAfter: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE parts SET quantity_on_hand = ? WHERE id = ?",
      [quantityAfter, partId],
    );
  }

  public async createInventoryTransaction(
    connection: PoolConnection,
    input: {
      partId: number;
      ticketId?: number | null;
      transactionType: InventoryTransactionType;
      quantity: number;
      quantityBefore: number;
      quantityAfter: number;
      referenceType?: string | null;
      referenceId?: number | null;
      performedBy: number;
      note?: string | null;
    },
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inventory_transactions (
          part_id, ticket_id, transaction_type, quantity, quantity_before,
          quantity_after, reference_type, reference_id, performed_by, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.partId,
        input.ticketId ?? null,
        input.transactionType,
        input.quantity,
        input.quantityBefore,
        input.quantityAfter,
        input.referenceType ?? null,
        input.referenceId ?? null,
        input.performedBy,
        input.note ?? null,
      ],
    );
    return result.insertId;
  }

  public async listInventoryTransactions(
    partId: number,
    query: ListInventoryTransactionsQuery,
  ): Promise<InventoryTransactionListRowsResult> {
    const conditions = ["it.part_id = ?"];
    const params: SqlValue[] = [partId];
    if (query.transactionType) {
      conditions.push("it.transaction_type = ?");
      params.push(query.transactionType);
    }
    const whereClause = conditions.join(" AND ");
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.query<InventoryTransactionRow[]>(
      `
        SELECT
          it.id,
          it.part_id,
          p.sku AS part_sku,
          p.name AS part_name,
          it.ticket_id,
          rt.ticket_code,
          it.transaction_type,
          it.quantity,
          it.quantity_before,
          it.quantity_after,
          it.reference_type,
          it.reference_id,
          it.performed_by,
          u.full_name AS performed_by_name,
          it.note,
          it.created_at
        FROM inventory_transactions AS it
        INNER JOIN parts AS p ON p.id = it.part_id
        INNER JOIN users AS u ON u.id = it.performed_by
        LEFT JOIN repair_tickets AS rt ON rt.id = it.ticket_id
        WHERE ${whereClause}
        ORDER BY it.created_at DESC, it.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(it.id) AS total FROM inventory_transactions AS it WHERE ${whereClause}`,
      params,
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  }
}

export const partRepository = new PartRepository();
