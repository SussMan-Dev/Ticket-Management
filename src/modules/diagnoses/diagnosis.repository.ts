import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { CreateDiagnosisDto, DiagnosisPartDto, UpdateDiagnosisDto } from "./diagnosis.dto.js";
import type {
  DiagnosisPartRow,
  DiagnosisRow,
  PartReferenceRow,
} from "./diagnosis.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | boolean | Date | null;

interface IdRow extends RowDataPacket {
  id: number;
}

const diagnosisColumns = `
  d.id,
  d.ticket_id,
  d.technician_id,
  technician.full_name AS technician_name,
  d.actual_issue,
  d.root_cause,
  d.proposed_solution,
  d.labor_cost,
  d.estimated_hours,
  d.data_loss_risk,
  d.risk_note,
  d.status,
  d.submitted_at,
  d.approved_by,
  approver.full_name AS approved_by_name,
  d.approved_at,
  d.created_at,
  d.updated_at
`;

const diagnosisJoins = `
  INNER JOIN users AS technician ON technician.id = d.technician_id
  LEFT JOIN users AS approver ON approver.id = d.approved_by
`;

export class DiagnosisRepository {
  public async listByTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    approvedOnly = false,
  ): Promise<DiagnosisRow[]> {
    const statusCondition = approvedOnly ? "AND d.status = 'APPROVED'" : "";
    const [rows] = await executor.execute<DiagnosisRow[]>(
      `
        SELECT ${diagnosisColumns}
        FROM diagnoses AS d
        ${diagnosisJoins}
        WHERE d.ticket_id = ?
          ${statusCondition}
        ORDER BY d.created_at ASC, d.id ASC
      `,
      [ticketId],
    );

    return rows;
  }

  public async findById(
    executor: DatabaseExecutor,
    diagnosisId: number,
    lockForUpdate = false,
  ): Promise<DiagnosisRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<DiagnosisRow[]>(
      `
        SELECT ${diagnosisColumns}
        FROM diagnoses AS d
        ${diagnosisJoins}
        WHERE d.id = ?
        LIMIT 1
        ${lockingClause}
      `,
      [diagnosisId],
    );

    return rows[0] ?? null;
  }

  public async findOpenByTicketForUpdate(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<DiagnosisRow | null> {
    const [rows] = await connection.execute<DiagnosisRow[]>(
      `
        SELECT ${diagnosisColumns}
        FROM diagnoses AS d
        ${diagnosisJoins}
        WHERE d.ticket_id = ?
          AND d.status IN ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED')
        ORDER BY d.id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [ticketId],
    );

    return rows[0] ?? null;
  }

  public async create(
    connection: PoolConnection,
    ticketId: number,
    technicianId: number,
    input: CreateDiagnosisDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO diagnoses (
          ticket_id,
          technician_id,
          actual_issue,
          root_cause,
          proposed_solution,
          labor_cost,
          estimated_hours,
          data_loss_risk,
          risk_note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ticketId,
        technicianId,
        input.actualIssue,
        input.rootCause ?? null,
        input.proposedSolution,
        input.laborCost,
        input.estimatedHours ?? null,
        input.dataLossRisk,
        input.riskNote ?? null,
      ],
    );

    return result.insertId;
  }

  public async update(
    connection: PoolConnection,
    diagnosisId: number,
    input: UpdateDiagnosisDto,
  ): Promise<void> {
    const columnByField: Record<
      Exclude<keyof UpdateDiagnosisDto, "parts">,
      string
    > = {
      actualIssue: "actual_issue",
      rootCause: "root_cause",
      proposedSolution: "proposed_solution",
      laborCost: "labor_cost",
      estimatedHours: "estimated_hours",
      dataLossRisk: "data_loss_risk",
      riskNote: "risk_note",
    };
    const assignments: string[] = [];
    const params: SqlValue[] = [];

    for (const field of Object.keys(columnByField) as Array<keyof typeof columnByField>) {
      const value = input[field];
      if (value !== undefined) {
        assignments.push(`${columnByField[field]} = ?`);
        params.push(value);
      }
    }

    if (assignments.length === 0) {
      return;
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE diagnoses
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      [...params, diagnosisId],
    );
  }

  public async markDraft(
    connection: PoolConnection,
    diagnosisId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE diagnoses
        SET
          status = 'DRAFT',
          submitted_at = NULL,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = ?
      `,
      [diagnosisId],
    );
  }

  public async markSubmitted(
    connection: PoolConnection,
    diagnosisId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE diagnoses
        SET
          status = 'SUBMITTED',
          submitted_at = CURRENT_TIMESTAMP,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = ?
      `,
      [diagnosisId],
    );
  }

  public async markRevisionRequired(
    connection: PoolConnection,
    diagnosisId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE diagnoses
        SET status = 'REVISION_REQUIRED'
        WHERE id = ?
      `,
      [diagnosisId],
    );
  }

  public async approve(
    connection: PoolConnection,
    diagnosisId: number,
    approvedBy: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE diagnoses
        SET
          status = 'APPROVED',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [approvedBy, diagnosisId],
    );
  }

  public async findActivePartsForUpdate(
    connection: PoolConnection,
    partIds: number[],
  ): Promise<PartReferenceRow[]> {
    if (partIds.length === 0) {
      return [];
    }

    const placeholders = partIds.map(() => "?").join(", ");
    const [rows] = await connection.execute<PartReferenceRow[]>(
      `
        SELECT p.id
        FROM parts AS p
        WHERE p.id IN (${placeholders})
          AND p.is_active = TRUE
        FOR UPDATE
      `,
      partIds,
    );

    return rows;
  }

  public async replaceParts(
    connection: PoolConnection,
    diagnosisId: number,
    parts: DiagnosisPartDto[],
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM diagnosis_parts
        WHERE diagnosis_id = ?
      `,
      [diagnosisId],
    );

    if (parts.length === 0) {
      return;
    }

    const valuesClause = parts.map(() => "(?, ?, ?, ?)").join(", ");
    const params = parts.flatMap((part) => [
      diagnosisId,
      part.partId,
      part.quantity,
      part.note ?? null,
    ]);
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO diagnosis_parts (
          diagnosis_id,
          part_id,
          quantity,
          note
        )
        VALUES ${valuesClause}
      `,
      params,
    );
  }

  public async listPartsByDiagnosisIds(
    executor: DatabaseExecutor,
    diagnosisIds: number[],
  ): Promise<DiagnosisPartRow[]> {
    if (diagnosisIds.length === 0) {
      return [];
    }

    const placeholders = diagnosisIds.map(() => "?").join(", ");
    const [rows] = await executor.execute<DiagnosisPartRow[]>(
      `
        SELECT
          dp.id,
          dp.diagnosis_id,
          dp.part_id,
          p.sku,
          p.name AS part_name,
          dp.quantity,
          dp.note,
          dp.created_at
        FROM diagnosis_parts AS dp
        INNER JOIN parts AS p ON p.id = dp.part_id
        WHERE dp.diagnosis_id IN (${placeholders})
        ORDER BY dp.created_at ASC, dp.id ASC
      `,
      diagnosisIds,
    );

    return rows;
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

export const diagnosisRepository = new DiagnosisRepository();
