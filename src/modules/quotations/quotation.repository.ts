import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type {
  ApprovedDiagnosisSnapshotRow,
  CatalogPartSnapshotRow,
  QuotationItemRecord,
  QuotationItemRow,
  QuotationRow,
  QuotationStatus,
} from "./quotation.model.js";

type DatabaseExecutor = Pool | PoolConnection;

interface VersionRow extends RowDataPacket {
  next_version: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface QuotationAmounts {
  laborAmount: number;
  partsAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CreateQuotationRecord extends QuotationAmounts {
  ticketId: number;
  diagnosisId: number;
  version: number;
  expiresAt: Date | null;
  createdBy: number;
}

const quotationColumns = `
  q.id,
  q.ticket_id,
  q.diagnosis_id,
  q.version,
  q.status,
  q.labor_amount,
  q.parts_amount,
  q.discount_amount,
  q.tax_amount,
  q.total_amount,
  q.expires_at,
  q.created_by,
  creator.full_name AS created_by_name,
  q.approved_by,
  approver.full_name AS approved_by_name,
  q.approved_at,
  q.sent_at,
  q.customer_responded_at,
  q.customer_response_note,
  q.created_at,
  q.updated_at
`;

const quotationJoins = `
  INNER JOIN users AS creator ON creator.id = q.created_by
  LEFT JOIN users AS approver ON approver.id = q.approved_by
`;

export class QuotationRepository {
  public async listByTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    customerVisibleOnly = false,
  ): Promise<QuotationRow[]> {
    const visibilityCondition = customerVisibleOnly
      ? "AND q.sent_at IS NOT NULL"
      : "";
    const [rows] = await executor.execute<QuotationRow[]>(
      `
        SELECT ${quotationColumns}
        FROM quotations AS q
        ${quotationJoins}
        WHERE q.ticket_id = ?
          ${visibilityCondition}
        ORDER BY q.version DESC, q.id DESC
      `,
      [ticketId],
    );

    return rows;
  }

  public async findById(
    executor: DatabaseExecutor,
    quotationId: number,
    lockForUpdate = false,
  ): Promise<QuotationRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<QuotationRow[]>(
      `
        SELECT ${quotationColumns}
        FROM quotations AS q
        ${quotationJoins}
        WHERE q.id = ?
        LIMIT 1
        ${lockingClause}
      `,
      [quotationId],
    );

    return rows[0] ?? null;
  }

  public async findCurrentByTicketForUpdate(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<QuotationRow | null> {
    const [rows] = await connection.execute<QuotationRow[]>(
      `
        SELECT ${quotationColumns}
        FROM quotations AS q
        ${quotationJoins}
        WHERE q.ticket_id = ?
          AND q.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT')
        ORDER BY q.version DESC, q.id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [ticketId],
    );

    return rows[0] ?? null;
  }

  public async findApprovedDiagnosisForUpdate(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<ApprovedDiagnosisSnapshotRow | null> {
    const [rows] = await connection.execute<ApprovedDiagnosisSnapshotRow[]>(
      `
        SELECT d.id, d.proposed_solution, d.labor_cost
        FROM diagnoses AS d
        WHERE d.ticket_id = ?
          AND d.status = 'APPROVED'
        ORDER BY d.approved_at DESC, d.id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [ticketId],
    );

    return rows[0] ?? null;
  }

  public async listDiagnosisPartSnapshotsForUpdate(
    connection: PoolConnection,
    diagnosisId: number,
  ): Promise<CatalogPartSnapshotRow[]> {
    const [rows] = await connection.execute<CatalogPartSnapshotRow[]>(
      `
        SELECT
          p.id,
          p.sku,
          p.name,
          p.selling_price,
          dp.quantity
        FROM diagnosis_parts AS dp
        INNER JOIN parts AS p ON p.id = dp.part_id
        WHERE dp.diagnosis_id = ?
        ORDER BY dp.created_at ASC, dp.id ASC
        FOR UPDATE
      `,
      [diagnosisId],
    );

    return rows;
  }

  public async findActiveCatalogPartsForUpdate(
    connection: PoolConnection,
    partIds: number[],
  ): Promise<CatalogPartSnapshotRow[]> {
    if (partIds.length === 0) return [];

    const placeholders = partIds.map(() => "?").join(", ");
    const [rows] = await connection.execute<CatalogPartSnapshotRow[]>(
      `
        SELECT p.id, p.sku, p.name, p.selling_price
        FROM parts AS p
        WHERE p.id IN (${placeholders})
          AND p.is_active = TRUE
        FOR UPDATE
      `,
      partIds,
    );

    return rows;
  }

  public async nextVersion(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<number> {
    const [rows] = await executor.execute<VersionRow[]>(
      `
        SELECT COALESCE(MAX(q.version), 0) + 1 AS next_version
        FROM quotations AS q
        WHERE q.ticket_id = ?
      `,
      [ticketId],
    );

    return rows[0]?.next_version ?? 1;
  }

  public async create(
    connection: PoolConnection,
    input: CreateQuotationRecord,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO quotations (
          ticket_id,
          diagnosis_id,
          version,
          labor_amount,
          parts_amount,
          discount_amount,
          tax_amount,
          total_amount,
          expires_at,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.ticketId,
        input.diagnosisId,
        input.version,
        input.laborAmount,
        input.partsAmount,
        input.discountAmount,
        input.taxAmount,
        input.totalAmount,
        input.expiresAt,
        input.createdBy,
      ],
    );

    return result.insertId;
  }

  public async replaceItems(
    connection: PoolConnection,
    quotationId: number,
    items: QuotationItemRecord[],
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "DELETE FROM quotation_items WHERE quotation_id = ?",
      [quotationId],
    );

    const valuesClause = items.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params = items.flatMap((item) => [
      quotationId,
      item.itemType,
      item.partId,
      item.description,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
    ]);
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO quotation_items (
          quotation_id,
          item_type,
          part_id,
          description,
          quantity,
          unit_price,
          line_total
        )
        VALUES ${valuesClause}
      `,
      params,
    );
  }

  public async listItemsByQuotationIds(
    executor: DatabaseExecutor,
    quotationIds: number[],
  ): Promise<QuotationItemRow[]> {
    if (quotationIds.length === 0) return [];

    const placeholders = quotationIds.map(() => "?").join(", ");
    const [rows] = await executor.execute<QuotationItemRow[]>(
      `
        SELECT
          qi.id,
          qi.quotation_id,
          qi.item_type,
          qi.part_id,
          qi.description,
          qi.quantity,
          qi.unit_price,
          qi.line_total,
          qi.created_at
        FROM quotation_items AS qi
        WHERE qi.quotation_id IN (${placeholders})
        ORDER BY qi.created_at ASC, qi.id ASC
      `,
      quotationIds,
    );

    return rows;
  }

  public async updateDraft(
    connection: PoolConnection,
    quotationId: number,
    expiresAt: Date | null,
    amounts: QuotationAmounts,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE quotations
        SET
          expires_at = ?,
          labor_amount = ?,
          parts_amount = ?,
          discount_amount = ?,
          tax_amount = ?,
          total_amount = ?
        WHERE id = ?
      `,
      [
        expiresAt,
        amounts.laborAmount,
        amounts.partsAmount,
        amounts.discountAmount,
        amounts.taxAmount,
        amounts.totalAmount,
        quotationId,
      ],
    );
  }

  public async updateStatus(
    connection: PoolConnection,
    quotationId: number,
    status: QuotationStatus,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE quotations SET status = ? WHERE id = ?",
      [status, quotationId],
    );
  }

  public async approve(
    connection: PoolConnection,
    quotationId: number,
    approvedBy: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE quotations
        SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [approvedBy, quotationId],
    );
  }

  public async markSent(
    connection: PoolConnection,
    quotationId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE quotations
        SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [quotationId],
    );
  }

  public async recordCustomerResponse(
    connection: PoolConnection,
    quotationId: number,
    status: "ACCEPTED" | "REJECTED",
    note: string | null,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE quotations
        SET
          status = ?,
          customer_responded_at = CURRENT_TIMESTAMP,
          customer_response_note = ?
        WHERE id = ?
      `,
      [status, note, quotationId],
    );
  }

  public async countPartItems(
    executor: DatabaseExecutor,
    quotationId: number,
  ): Promise<number> {
    const [rows] = await executor.execute<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM quotation_items AS qi
        WHERE qi.quotation_id = ?
          AND qi.item_type = 'PART'
      `,
      [quotationId],
    );
    return rows[0]?.total ?? 0;
  }

  public async findActiveManagerIds(
    executor: DatabaseExecutor,
  ): Promise<number[]> {
    const [rows] = await executor.execute<IdRow[]>(
      `
        SELECT u.id
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE r.code = 'MANAGER'
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
          user_id,
          type,
          title,
          content,
          reference_type,
          reference_id
        )
        VALUES (?, ?, ?, ?, 'REPAIR_TICKET', ?)
      `,
      [input.userId, input.type, input.title, input.content, input.ticketId],
    );
    return result.insertId;
  }
}

export const quotationRepository = new QuotationRepository();
