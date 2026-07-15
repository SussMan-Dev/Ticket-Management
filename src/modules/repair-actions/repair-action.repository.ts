import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  CreateRepairLogDto,
  CreateTestResultDto,
  RepairLogPartDto,
  UpdateRepairLogDto,
} from "./repair-action.dto.js";
import type {
  PartUsageTotalRow,
  RepairLogPartRow,
  RepairLogRow,
  TestResultRow,
  TimelineEventRow,
} from "./repair-action.model.js";

type DatabaseExecutor = Pool | PoolConnection;

const repairLogColumns = `
  rl.id,
  rl.ticket_id,
  rl.technician_id,
  technician.full_name AS technician_name,
  rl.action_description,
  rl.result,
  rl.started_at,
  rl.finished_at,
  rl.created_at,
  rl.updated_at
`;

export class RepairActionRepository {
  public async listRepairLogs(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<RepairLogRow[]> {
    const [rows] = await executor.execute<RepairLogRow[]>(
      `
        SELECT ${repairLogColumns}
        FROM repair_logs AS rl
        INNER JOIN users AS technician ON technician.id = rl.technician_id
        WHERE rl.ticket_id = ?
        ORDER BY COALESCE(rl.started_at, rl.created_at) DESC, rl.id DESC
      `,
      [ticketId],
    );
    return rows;
  }

  public async findRepairLogById(
    executor: DatabaseExecutor,
    repairLogId: number,
    lockForUpdate = false,
  ): Promise<RepairLogRow | null> {
    const lockingClause = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<RepairLogRow[]>(
      `
        SELECT ${repairLogColumns}
        FROM repair_logs AS rl
        INNER JOIN users AS technician ON technician.id = rl.technician_id
        WHERE rl.id = ?
        LIMIT 1
        ${lockingClause}
      `,
      [repairLogId],
    );
    return rows[0] ?? null;
  }

  public async listRepairLogParts(
    executor: DatabaseExecutor,
    repairLogIds: number[],
  ): Promise<RepairLogPartRow[]> {
    if (repairLogIds.length === 0) {
      return [];
    }
    const placeholders = repairLogIds.map(() => "?").join(", ");
    const [rows] = await executor.execute<RepairLogPartRow[]>(
      `
        SELECT
          rlp.id,
          rlp.repair_log_id,
          rlp.part_id,
          p.sku AS part_sku,
          p.name AS part_name,
          p.unit AS part_unit,
          rlp.quantity,
          rlp.created_at
        FROM repair_log_parts AS rlp
        INNER JOIN parts AS p ON p.id = rlp.part_id
        WHERE rlp.repair_log_id IN (${placeholders})
        ORDER BY rlp.created_at ASC, rlp.id ASC
      `,
      repairLogIds,
    );
    return rows;
  }

  public async createRepairLog(
    connection: PoolConnection,
    ticketId: number,
    technicianId: number,
    input: CreateRepairLogDto,
    startedAt: Date,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO repair_logs (
          ticket_id,
          technician_id,
          action_description,
          result,
          started_at,
          finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        ticketId,
        technicianId,
        input.actionDescription,
        input.result ?? null,
        startedAt,
        input.finishedAt ?? null,
      ],
    );
    return result.insertId;
  }

  public async updateRepairLog(
    connection: PoolConnection,
    repairLogId: number,
    input: Omit<UpdateRepairLogDto, "parts">,
  ): Promise<void> {
    const assignments: string[] = [];
    const values: Array<string | Date | null> = [];

    if (input.actionDescription !== undefined) {
      assignments.push("action_description = ?");
      values.push(input.actionDescription);
    }
    if (input.result !== undefined) {
      assignments.push("result = ?");
      values.push(input.result);
    }
    if (input.startedAt !== undefined) {
      assignments.push("started_at = ?");
      values.push(input.startedAt);
    }
    if (input.finishedAt !== undefined) {
      assignments.push("finished_at = ?");
      values.push(input.finishedAt);
    }
    if (assignments.length === 0) {
      return;
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE repair_logs
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
      [...values, repairLogId],
    );
  }

  public async replaceRepairLogParts(
    connection: PoolConnection,
    repairLogId: number,
    parts: RepairLogPartDto[],
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "DELETE FROM repair_log_parts WHERE repair_log_id = ?",
      [repairLogId],
    );
    for (const part of parts) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO repair_log_parts (repair_log_id, part_id, quantity)
          VALUES (?, ?, ?)
        `,
        [repairLogId, part.partId, part.quantity],
      );
    }
  }

  public async listFulfilledPartTotals(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<PartUsageTotalRow[]> {
    const [rows] = await executor.execute<PartUsageTotalRow[]>(
      `
        SELECT
          pri.part_id,
          CAST(SUM(pri.fulfilled_quantity) AS SIGNED) AS quantity
        FROM part_request_items AS pri
        INNER JOIN part_requests AS pr ON pr.id = pri.part_request_id
        WHERE pr.ticket_id = ?
          AND pr.status IN ('PARTIALLY_FULFILLED', 'FULFILLED')
          AND pri.fulfilled_quantity > 0
        GROUP BY pri.part_id
      `,
      [ticketId],
    );
    return rows;
  }

  public async listUsedPartTotals(
    executor: DatabaseExecutor,
    ticketId: number,
    excludingRepairLogId?: number,
  ): Promise<PartUsageTotalRow[]> {
    const exclusion = excludingRepairLogId === undefined ? "" : "AND rl.id <> ?";
    const params = excludingRepairLogId === undefined
      ? [ticketId]
      : [ticketId, excludingRepairLogId];
    const [rows] = await executor.execute<PartUsageTotalRow[]>(
      `
        SELECT
          rlp.part_id,
          CAST(SUM(rlp.quantity) AS SIGNED) AS quantity
        FROM repair_log_parts AS rlp
        INNER JOIN repair_logs AS rl ON rl.id = rlp.repair_log_id
        WHERE rl.ticket_id = ?
          ${exclusion}
        GROUP BY rlp.part_id
      `,
      params,
    );
    return rows;
  }

  public async hasFinishedRepairLog(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<boolean> {
    const [rows] = await executor.execute<Array<PartUsageTotalRow>>(
      `
        SELECT 1 AS part_id, COUNT(id) AS quantity
        FROM repair_logs
        WHERE ticket_id = ?
          AND finished_at IS NOT NULL
      `,
      [ticketId],
    );
    return (rows[0]?.quantity ?? 0) > 0;
  }

  public async listTestResults(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<TestResultRow[]> {
    const [rows] = await executor.execute<TestResultRow[]>(
      `
        SELECT
          tr.id,
          tr.ticket_id,
          tr.tested_by,
          tester.full_name AS tested_by_name,
          tr.test_name,
          tr.result,
          tr.note,
          tr.tested_at
        FROM test_results AS tr
        INNER JOIN users AS tester ON tester.id = tr.tested_by
        WHERE tr.ticket_id = ?
        ORDER BY tr.tested_at DESC, tr.id DESC
      `,
      [ticketId],
    );
    return rows;
  }

  public async createTestResult(
    connection: PoolConnection,
    ticketId: number,
    testedBy: number,
    input: CreateTestResultDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO test_results (ticket_id, tested_by, test_name, result, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [ticketId, testedBy, input.testName, input.result, input.note ?? null],
    );
    return result.insertId;
  }

  public async findTestResultById(
    executor: DatabaseExecutor,
    testResultId: number,
  ): Promise<TestResultRow | null> {
    const [rows] = await executor.execute<TestResultRow[]>(
      `
        SELECT
          tr.id,
          tr.ticket_id,
          tr.tested_by,
          tester.full_name AS tested_by_name,
          tr.test_name,
          tr.result,
          tr.note,
          tr.tested_at
        FROM test_results AS tr
        INNER JOIN users AS tester ON tester.id = tr.tested_by
        WHERE tr.id = ?
        LIMIT 1
      `,
      [testResultId],
    );
    return rows[0] ?? null;
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

  public async listTimeline(ticketId: number): Promise<TimelineEventRow[]> {
    const [rows] = await pool.execute<TimelineEventRow[]>(
      `
        SELECT timeline.*
        FROM (
          SELECT
            CONCAT('STATUS:', tsh.id) AS event_key,
            'TICKET_STATUS' AS event_type,
            CONCAT('Ticket status: ', tsh.to_status) AS title,
            tsh.reason AS description,
            tsh.changed_by AS actor_id,
            actor.full_name AS actor_name,
            actor_role.code AS actor_role,
            tsh.created_at AS occurred_at
          FROM ticket_status_history AS tsh
          INNER JOIN users AS actor ON actor.id = tsh.changed_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE tsh.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('ASSIGNMENT:', ta.id),
            'ASSIGNMENT',
            'Technician assigned',
            technician.full_name,
            ta.assigned_by,
            actor.full_name,
            actor_role.code,
            ta.assigned_at
          FROM ticket_assignments AS ta
          INNER JOIN users AS technician ON technician.id = ta.technician_id
          INNER JOIN users AS actor ON actor.id = ta.assigned_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE ta.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('DIAGNOSIS:', d.id),
            'DIAGNOSIS',
            CONCAT('Diagnosis: ', d.status),
            NULL,
            d.technician_id,
            actor.full_name,
            actor_role.code,
            d.created_at
          FROM diagnoses AS d
          INNER JOIN users AS actor ON actor.id = d.technician_id
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE d.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('QUOTATION:', q.id),
            'QUOTATION',
            CONCAT('Quotation v', q.version, ': ', q.status),
            NULL,
            q.created_by,
            actor.full_name,
            actor_role.code,
            q.created_at
          FROM quotations AS q
          INNER JOIN users AS actor ON actor.id = q.created_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE q.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('PART_REQUEST:', pr.id),
            'PART_REQUEST',
            CONCAT('Part request: ', pr.status),
            NULL,
            pr.requested_by,
            actor.full_name,
            actor_role.code,
            pr.created_at
          FROM part_requests AS pr
          INNER JOIN users AS actor ON actor.id = pr.requested_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE pr.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('INVENTORY:', it.id),
            'INVENTORY_MOVEMENT',
            CONCAT('Inventory movement: ', it.transaction_type),
            CONCAT(it.quantity, ' ', p.unit, ' ', p.sku),
            it.performed_by,
            actor.full_name,
            actor_role.code,
            it.created_at
          FROM inventory_transactions AS it
          INNER JOIN parts AS p ON p.id = it.part_id
          INNER JOIN users AS actor ON actor.id = it.performed_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE it.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('REPAIR_LOG:', rl.id),
            'REPAIR_LOG',
            CASE
              WHEN rl.finished_at IS NULL THEN 'Repair work recorded'
              ELSE 'Repair work completed'
            END,
            rl.action_description,
            rl.technician_id,
            actor.full_name,
            actor_role.code,
            rl.created_at
          FROM repair_logs AS rl
          INNER JOIN users AS actor ON actor.id = rl.technician_id
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE rl.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('TEST_RESULT:', tr.id),
            'TEST_RESULT',
            CONCAT('Test result: ', tr.result),
            tr.test_name,
            tr.tested_by,
            actor.full_name,
            actor_role.code,
            tr.tested_at
          FROM test_results AS tr
          INNER JOIN users AS actor ON actor.id = tr.tested_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE tr.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('INVOICE:', i.id),
            'INVOICE',
            CONCAT('Invoice ', i.invoice_code, ': ', i.payment_status),
            CONCAT('Total amount: ', i.total_amount),
            i.created_by,
            actor.full_name,
            actor_role.code,
            i.created_at
          FROM invoices AS i
          INNER JOIN users AS actor ON actor.id = i.created_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE i.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('PAYMENT:', p.id),
            'PAYMENT',
            CONCAT('Payment ', p.payment_code, ': ', p.status),
            CONCAT(p.amount, ' via ', p.method),
            p.received_by,
            actor.full_name,
            actor_role.code,
            p.paid_at
          FROM payments AS p
          INNER JOIN invoices AS i ON i.id = p.invoice_id
          INNER JOIN users AS actor ON actor.id = p.received_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE i.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('DELIVERY:', d.id),
            'DELIVERY',
            'Device delivered',
            CONCAT('Recipient: ', d.recipient_name),
            d.delivered_by,
            actor.full_name,
            actor_role.code,
            d.delivered_at
          FROM deliveries AS d
          INNER JOIN users AS actor ON actor.id = d.delivered_by
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE d.ticket_id = ?

          UNION ALL

          SELECT
            CONCAT('REVIEW:', r.id),
            'REVIEW',
            CONCAT('Customer review: ', r.rating, '/5'),
            r.comment,
            r.customer_id,
            actor.full_name,
            actor_role.code,
            r.created_at
          FROM reviews AS r
          INNER JOIN users AS actor ON actor.id = r.customer_id
          INNER JOIN roles AS actor_role ON actor_role.id = actor.role_id
          WHERE r.ticket_id = ?
        ) AS timeline
        ORDER BY timeline.occurred_at ASC, timeline.event_key ASC
      `,
      Array(12).fill(ticketId),
    );
    return rows;
  }
}

export const repairActionRepository = new RepairActionRepository();
