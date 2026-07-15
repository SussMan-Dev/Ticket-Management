import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
} from "mysql2/promise";
import type {
  AssignableTechnicianRow,
  TicketAssignmentRow,
} from "./ticket-assignment.model.js";

type DatabaseExecutor = Pool | PoolConnection;

const assignmentColumns = `
  ta.id,
  ta.ticket_id,
  ta.technician_id,
  technician.full_name AS technician_name,
  technician.email AS technician_email,
  ta.assigned_by,
  assigner.full_name AS assigned_by_name,
  ta.assigned_at,
  ta.unassigned_at,
  ta.is_active,
  ta.note
`;

const assignmentJoins = `
  INNER JOIN users AS technician ON technician.id = ta.technician_id
  INNER JOIN users AS assigner ON assigner.id = ta.assigned_by
`;

export class TicketAssignmentRepository {
  public async findTechnicianForUpdate(
    connection: PoolConnection,
    technicianId: number,
  ): Promise<AssignableTechnicianRow | null> {
    const [rows] = await connection.execute<AssignableTechnicianRow[]>(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          r.code AS role,
          u.status,
          u.locked_until
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.id = ?
          AND u.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `,
      [technicianId],
    );

    return rows[0] ?? null;
  }

  public async findActiveByTicketForUpdate(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<TicketAssignmentRow | null> {
    const [rows] = await connection.execute<TicketAssignmentRow[]>(
      `
        SELECT ${assignmentColumns}
        FROM ticket_assignments AS ta
        ${assignmentJoins}
        WHERE ta.ticket_id = ?
          AND ta.is_active = TRUE
          AND ta.unassigned_at IS NULL
        ORDER BY ta.id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [ticketId],
    );

    return rows[0] ?? null;
  }

  public async findById(
    executor: DatabaseExecutor,
    assignmentId: number,
  ): Promise<TicketAssignmentRow | null> {
    const [rows] = await executor.execute<TicketAssignmentRow[]>(
      `
        SELECT ${assignmentColumns}
        FROM ticket_assignments AS ta
        ${assignmentJoins}
        WHERE ta.id = ?
        LIMIT 1
      `,
      [assignmentId],
    );

    return rows[0] ?? null;
  }

  public async create(
    connection: PoolConnection,
    input: {
      ticketId: number;
      technicianId: number;
      assignedBy: number;
      note?: string | null;
    },
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO ticket_assignments (
          ticket_id,
          technician_id,
          assigned_by,
          note
        )
        VALUES (?, ?, ?, ?)
      `,
      [input.ticketId, input.technicianId, input.assignedBy, input.note ?? null],
    );

    return result.insertId;
  }

  public async deactivate(
    connection: PoolConnection,
    assignmentId: number,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        UPDATE ticket_assignments
        SET
          is_active = FALSE,
          unassigned_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND is_active = TRUE
          AND unassigned_at IS NULL
      `,
      [assignmentId],
    );
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

export const ticketAssignmentRepository = new TicketAssignmentRepository();
