import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { TicketStatus } from "../../common/constants/ticket-status.js";
import { pool } from "../../config/database.js";
import type {
  CreateRepairTicketDto,
  CreateTicketAttachmentDto,
  ListRepairTicketsQuery,
  UpdateRepairTicketDto,
} from "./repair-ticket.dto.js";
import type {
  RepairTicketRow,
  TicketAttachmentRow,
  TicketCustomerReferenceRow,
  TicketDeviceReferenceRow,
  TicketStatusHistoryRow,
} from "./repair-ticket.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

interface ExistsRow extends RowDataPacket {
  exists_value: number;
}

export interface CreateRepairTicketRecord
  extends Omit<CreateRepairTicketDto, "customerId" | "receiveNow"> {
  placeholderCode: string;
  customerId: number;
  createdBy: number;
  status: TicketStatus;
}

export interface RepairTicketListRowsResult {
  rows: RepairTicketRow[];
  total: number;
}

const ticketColumns = `
  rt.id,
  rt.ticket_code,
  rt.customer_id,
  customer.full_name AS customer_name,
  rt.device_id,
  d.model AS device_model,
  d.serial_number AS device_serial_number,
  dc.name AS device_category,
  db.name AS device_brand,
  rt.created_by,
  creator.full_name AS creator_name,
  rt.title,
  rt.customer_issue,
  rt.initial_condition,
  rt.accessories_received,
  rt.status,
  rt.priority,
  rt.expected_diagnosis_at,
  rt.expected_completion_at,
  rt.received_at,
  rt.completed_at,
  rt.delivered_at,
  rt.closed_at,
  rt.cancellation_reason,
  rt.created_at,
  rt.updated_at
`;

const ticketJoins = `
  INNER JOIN users AS customer ON customer.id = rt.customer_id
  INNER JOIN devices AS d ON d.id = rt.device_id
  INNER JOIN device_categories AS dc ON dc.id = d.category_id
  LEFT JOIN device_brands AS db ON db.id = d.brand_id
  INNER JOIN users AS creator ON creator.id = rt.created_by
`;

export class RepairTicketRepository {
  public async list(query: ListRepairTicketsQuery): Promise<RepairTicketListRowsResult> {
    const conditions = ["rt.deleted_at IS NULL"];
    const params: SqlValue[] = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push(
        "(rt.ticket_code LIKE ? OR rt.title LIKE ? OR rt.customer_issue LIKE ?)",
      );
      params.push(search, search, search);
    }

    if (query.status) {
      conditions.push("rt.status = ?");
      params.push(query.status);
    }

    if (query.priority) {
      conditions.push("rt.priority = ?");
      params.push(query.priority);
    }

    if (query.customerId !== undefined) {
      conditions.push("rt.customer_id = ?");
      params.push(query.customerId);
    }

    if (query.deviceId !== undefined) {
      conditions.push("rt.device_id = ?");
      params.push(query.deviceId);
    }

    if (query.assignedTechnicianId !== undefined) {
      conditions.push(`
        EXISTS(
          SELECT 1
          FROM ticket_assignments AS ta
          WHERE ta.ticket_id = rt.id
            AND ta.technician_id = ?
            AND ta.is_active = TRUE
            AND ta.unassigned_at IS NULL
        )
      `);
      params.push(query.assignedTechnicianId);
    }

    const whereClause = conditions.join(" AND ");
    const sortColumns: Record<ListRepairTicketsQuery["sortBy"], string> = {
      createdAt: "rt.created_at",
      updatedAt: "rt.updated_at",
      priority: "rt.priority",
      status: "rt.status",
    };
    const sortDirection = query.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (query.page - 1) * query.limit;

    const [rows] = await pool.execute<RepairTicketRow[]>(
      `
        SELECT ${ticketColumns}
        FROM repair_tickets AS rt
        ${ticketJoins}
        WHERE ${whereClause}
        ORDER BY ${sortColumns[query.sortBy]} ${sortDirection}, rt.id ${sortDirection}
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `
        SELECT COUNT(rt.id) AS total
        FROM repair_tickets AS rt
        WHERE ${whereClause}
      `,
      params,
    );

    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findById(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<RepairTicketRow[]>(
      `
        SELECT ${ticketColumns}
        FROM repair_tickets AS rt
        ${ticketJoins}
        WHERE rt.id = ?
          AND rt.deleted_at IS NULL
        LIMIT 1
        ${lockingClause}
      `,
      [ticketId],
    );

    return rows[0] ?? null;
  }

  public async findCustomer(
    executor: DatabaseExecutor,
    customerId: number,
  ): Promise<TicketCustomerReferenceRow | null> {
    const [rows] = await executor.execute<TicketCustomerReferenceRow[]>(
      `
        SELECT u.id, u.status
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.id = ?
          AND r.code = 'CUSTOMER'
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      [customerId],
    );

    return rows[0] ?? null;
  }

  public async findAvailableDeviceForCustomer(
    connection: PoolConnection,
    deviceId: number,
    customerId: number,
  ): Promise<TicketDeviceReferenceRow | null> {
    const [rows] = await connection.execute<TicketDeviceReferenceRow[]>(
      `
        SELECT d.id, d.customer_id
        FROM devices AS d
        INNER JOIN users AS customer ON customer.id = d.customer_id
        INNER JOIN roles AS r ON r.id = customer.role_id
        INNER JOIN device_categories AS dc ON dc.id = d.category_id
        WHERE d.id = ?
          AND d.customer_id = ?
          AND d.deleted_at IS NULL
          AND customer.deleted_at IS NULL
          AND customer.status = 'ACTIVE'
          AND r.code = 'CUSTOMER'
          AND dc.is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [deviceId, customerId],
    );

    return rows[0] ?? null;
  }

  public async hasActiveAssignment(
    executor: DatabaseExecutor,
    ticketId: number,
    technicianId: number,
  ): Promise<boolean> {
    const [rows] = await executor.execute<ExistsRow[]>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM ticket_assignments
          WHERE ticket_id = ?
            AND technician_id = ?
            AND is_active = TRUE
            AND unassigned_at IS NULL
        ) AS exists_value
      `,
      [ticketId, technicianId],
    );

    return Boolean(rows[0]?.exists_value);
  }

  public async create(
    connection: PoolConnection,
    input: CreateRepairTicketRecord,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO repair_tickets (
          ticket_code,
          customer_id,
          device_id,
          created_by,
          title,
          customer_issue,
          initial_condition,
          accessories_received,
          status,
          priority,
          expected_diagnosis_at,
          expected_completion_at,
          received_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.placeholderCode,
        input.customerId,
        input.deviceId,
        input.createdBy,
        input.title,
        input.customerIssue,
        input.initialCondition ?? null,
        input.accessoriesReceived ?? null,
        input.status,
        input.priority,
        input.expectedDiagnosisAt ?? null,
        input.expectedCompletionAt ?? null,
        input.status === "RECEIVED" ? new Date() : null,
      ],
    );

    return result.insertId;
  }

  public async setTicketCode(
    connection: PoolConnection,
    ticketId: number,
    ticketCode: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE repair_tickets
        SET ticket_code = ?
        WHERE id = ?
      `,
      [ticketCode, ticketId],
    );
  }

  public async update(
    connection: PoolConnection,
    ticketId: number,
    input: UpdateRepairTicketDto,
  ): Promise<void> {
    const columnByField: Record<keyof UpdateRepairTicketDto, string> = {
      title: "title",
      customerIssue: "customer_issue",
      initialCondition: "initial_condition",
      accessoriesReceived: "accessories_received",
      priority: "priority",
      expectedDiagnosisAt: "expected_diagnosis_at",
      expectedCompletionAt: "expected_completion_at",
    };
    const assignments: string[] = [];
    const params: SqlValue[] = [];

    for (const field of Object.keys(columnByField) as (keyof UpdateRepairTicketDto)[]) {
      const value = input[field];

      if (value !== undefined) {
        assignments.push(`${columnByField[field]} = ?`);
        params.push(value);
      }
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE repair_tickets
        SET ${assignments.join(", ")}
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [...params, ticketId],
    );
  }

  public async updateStatus(
    connection: PoolConnection,
    ticketId: number,
    status: TicketStatus,
    cancellationReason: string | null = null,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE repair_tickets
        SET
          status = ?,
          received_at = CASE
            WHEN ? = 'RECEIVED' THEN COALESCE(received_at, CURRENT_TIMESTAMP)
            ELSE received_at
          END,
          cancellation_reason = CASE
            WHEN ? = 'CANCELLED' THEN ?
            ELSE cancellation_reason
          END
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [status, status, status, cancellationReason, ticketId],
    );
  }

  public async createStatusHistory(
    connection: PoolConnection,
    input: {
      ticketId: number;
      changedBy: number;
      fromStatus: TicketStatus | null;
      toStatus: TicketStatus;
      reason?: string | null;
    },
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO ticket_status_history (
          ticket_id,
          changed_by,
          from_status,
          to_status,
          reason
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        input.ticketId,
        input.changedBy,
        input.fromStatus,
        input.toStatus,
        input.reason ?? null,
      ],
    );

    return result.insertId;
  }

  public async listStatusHistory(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<TicketStatusHistoryRow[]> {
    const [rows] = await executor.execute<TicketStatusHistoryRow[]>(
      `
        SELECT
          tsh.id,
          tsh.ticket_id,
          tsh.changed_by,
          u.full_name AS changed_by_name,
          r.code AS changed_by_role,
          tsh.from_status,
          tsh.to_status,
          tsh.reason,
          tsh.created_at
        FROM ticket_status_history AS tsh
        INNER JOIN users AS u ON u.id = tsh.changed_by
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE tsh.ticket_id = ?
        ORDER BY tsh.created_at ASC, tsh.id ASC
      `,
      [ticketId],
    );

    return rows;
  }

  public async listAttachments(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<TicketAttachmentRow[]> {
    const [rows] = await executor.execute<TicketAttachmentRow[]>(
      `
        SELECT
          ta.id,
          ta.ticket_id,
          ta.uploaded_by,
          u.full_name AS uploaded_by_name,
          r.code AS uploaded_by_role,
          ta.attachment_type,
          ta.file_url,
          ta.file_name,
          ta.mime_type,
          ta.created_at
        FROM ticket_attachments AS ta
        INNER JOIN users AS u ON u.id = ta.uploaded_by
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE ta.ticket_id = ?
        ORDER BY ta.created_at ASC, ta.id ASC
      `,
      [ticketId],
    );

    return rows;
  }

  public async createAttachment(
    connection: PoolConnection,
    ticketId: number,
    uploadedBy: number,
    input: CreateTicketAttachmentDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO ticket_attachments (
          ticket_id,
          uploaded_by,
          attachment_type,
          file_url,
          file_name,
          mime_type
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        ticketId,
        uploadedBy,
        input.attachmentType,
        input.fileUrl,
        input.fileName ?? null,
        input.mimeType ?? null,
      ],
    );

    return result.insertId;
  }

  public async findAttachmentById(
    executor: DatabaseExecutor,
    attachmentId: number,
  ): Promise<TicketAttachmentRow | null> {
    const [rows] = await executor.execute<TicketAttachmentRow[]>(
      `
        SELECT
          ta.id,
          ta.ticket_id,
          ta.uploaded_by,
          u.full_name AS uploaded_by_name,
          r.code AS uploaded_by_role,
          ta.attachment_type,
          ta.file_url,
          ta.file_name,
          ta.mime_type,
          ta.created_at
        FROM ticket_attachments AS ta
        INNER JOIN users AS u ON u.id = ta.uploaded_by
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE ta.id = ?
        LIMIT 1
      `,
      [attachmentId],
    );

    return rows[0] ?? null;
  }
}

export const repairTicketRepository = new RepairTicketRepository();
