import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  CreatePartRequestDto,
  ListPartRequestsQuery,
} from "./inventory.dto.js";
import type {
  PartRequestItemRow,
  PartRequestRow,
  PartRequestStatus,
} from "./inventory.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

export interface PartRequestListRowsResult {
  rows: PartRequestRow[];
  total: number;
}

const requestColumns = `
  pr.id,
  pr.ticket_id,
  rt.ticket_code,
  pr.requested_by,
  requester.full_name AS requested_by_name,
  pr.status,
  pr.note,
  pr.approved_by,
  approver.full_name AS approved_by_name,
  pr.approved_at,
  pr.created_at,
  pr.updated_at
`;

const requestJoins = `
  INNER JOIN repair_tickets AS rt ON rt.id = pr.ticket_id
  INNER JOIN users AS requester ON requester.id = pr.requested_by
  LEFT JOIN users AS approver ON approver.id = pr.approved_by
`;

export class InventoryRepository {
  public async list(
    query: ListPartRequestsQuery,
  ): Promise<PartRequestListRowsResult> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];
    if (query.status) {
      conditions.push("pr.status = ?");
      params.push(query.status);
    }
    if (query.ticketId !== undefined) {
      conditions.push("pr.ticket_id = ?");
      params.push(query.ticketId);
    }
    if (query.requestedBy !== undefined) {
      conditions.push("pr.requested_by = ?");
      params.push(query.requestedBy);
    }
    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.query<PartRequestRow[]>(
      `
        SELECT ${requestColumns}
        FROM part_requests AS pr
        ${requestJoins}
        ${whereClause}
        ORDER BY pr.created_at DESC, pr.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(pr.id) AS total FROM part_requests AS pr ${whereClause}`,
      params,
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    requestId: number,
    lockForUpdate = false,
  ): Promise<PartRequestRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<PartRequestRow[]>(
      `
        SELECT ${requestColumns}
        FROM part_requests AS pr
        ${requestJoins}
        WHERE pr.id = ?
        LIMIT 1
        ${lockingClause}
      `,
      [requestId],
    );
    return rows[0] ?? null;
  }

  public async listItemsByRequestIds(
    executor: DatabaseExecutor,
    requestIds: number[],
    lockForUpdate = false,
  ): Promise<PartRequestItemRow[]> {
    if (requestIds.length === 0) return [];
    const placeholders = requestIds.map(() => "?").join(", ");
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<PartRequestItemRow[]>(
      `
        SELECT
          pri.id,
          pri.part_request_id,
          pri.part_id,
          p.sku AS part_sku,
          p.name AS part_name,
          p.unit AS part_unit,
          p.selling_price,
          p.quantity_on_hand,
          p.is_active AS part_is_active,
          pri.requested_quantity,
          pri.fulfilled_quantity,
          pri.created_at
        FROM part_request_items AS pri
        INNER JOIN parts AS p ON p.id = pri.part_id
        WHERE pri.part_request_id IN (${placeholders})
        ORDER BY pri.part_id ASC, pri.id ASC
        ${lockingClause}
      `,
      requestIds,
    );
    return rows;
  }

  public async create(
    connection: PoolConnection,
    ticketId: number,
    requestedBy: number,
    input: CreatePartRequestDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO part_requests (ticket_id, requested_by, note) VALUES (?, ?, ?)`,
      [ticketId, requestedBy, input.note ?? null],
    );
    return result.insertId;
  }

  public async createItems(
    connection: PoolConnection,
    requestId: number,
    items: CreatePartRequestDto["items"],
  ): Promise<void> {
    const valuesClause = items.map(() => "(?, ?, ?)").join(", ");
    const params = items.flatMap((item) => [
      requestId,
      item.partId,
      item.requestedQuantity,
    ]);
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO part_request_items (
          part_request_id, part_id, requested_quantity
        )
        VALUES ${valuesClause}
      `,
      params,
    );
  }

  public async approve(
    connection: PoolConnection,
    requestId: number,
    approvedBy: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE part_requests
        SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [approvedBy, requestId],
    );
  }

  public async updateStatus(
    connection: PoolConnection,
    requestId: number,
    status: PartRequestStatus,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE part_requests SET status = ? WHERE id = ?",
      [status, requestId],
    );
  }

  public async addFulfilledQuantity(
    connection: PoolConnection,
    requestId: number,
    partId: number,
    quantity: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE part_request_items
        SET fulfilled_quantity = fulfilled_quantity + ?
        WHERE part_request_id = ? AND part_id = ?
      `,
      [quantity, requestId, partId],
    );
  }

  public async hasOtherOpenRequests(
    executor: DatabaseExecutor,
    ticketId: number,
    excludedRequestId: number,
  ): Promise<boolean> {
    const [rows] = await executor.execute<CountRow[]>(
      `
        SELECT COUNT(pr.id) AS total
        FROM part_requests AS pr
        WHERE pr.ticket_id = ?
          AND pr.id <> ?
          AND pr.status IN ('PENDING', 'APPROVED', 'PARTIALLY_FULFILLED')
      `,
      [ticketId, excludedRequestId],
    );
    return (rows[0]?.total ?? 0) > 0;
  }

  public async findActiveInventoryStaffIds(
    executor: DatabaseExecutor,
  ): Promise<number[]> {
    const [rows] = await executor.execute<IdRow[]>(
      `
        SELECT u.id
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE r.code = 'INVENTORY_STAFF'
          AND u.status = 'ACTIVE'
          AND u.deleted_at IS NULL
          AND (u.locked_until IS NULL OR u.locked_until <= CURRENT_TIMESTAMP)
      `,
    );
    return rows.map((row) => row.id);
  }

  public async createNotification(
    connection: PoolConnection,
    input: {
      userId: number;
      type: string;
      title: string;
      content: string;
      ticketId: number;
    },
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (
          user_id, type, title, content, reference_type, reference_id
        )
        VALUES (?, ?, ?, ?, 'REPAIR_TICKET', ?)
      `,
      [input.userId, input.type, input.title, input.content, input.ticketId],
    );
    return result.insertId;
  }
}

export const inventoryRepository = new InventoryRepository();
