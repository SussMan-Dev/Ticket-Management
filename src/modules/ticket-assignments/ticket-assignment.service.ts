import type { PoolConnection } from "mysql2/promise";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import {
  repairTicketRepository,
  type RepairTicketRepository,
} from "../repair-tickets/repair-ticket.repository.js";
import type { AssignTicketDto, ListAssignableTechniciansQuery, ReassignTicketDto } from "./ticket-assignment.dto.js";
import {
  toAssignableTechnician,
  toTicketAssignment,
  type AssignableTechnician,
  type AssignableTechnicianRow,
  type TicketAssignment,
} from "./ticket-assignment.model.js";
import {
  ticketAssignmentRepository,
  type TicketAssignmentRepository,
} from "./ticket-assignment.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class TicketAssignmentService {
  public constructor(
    private readonly repository: TicketAssignmentRepository = ticketAssignmentRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async listAssignableTechnicians(
    actor: Express.AuthenticatedUser,
    query: ListAssignableTechniciansQuery,
  ): Promise<AssignableTechnician[]> {
    this.assertManager(actor);
    return (await this.repository.listAssignableTechnicians(pool, query.search))
      .map(toAssignableTechnician);
  }

  public async assign(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: AssignTicketDto,
    metadata: RequestMetadata,
  ): Promise<TicketAssignment> {
    this.assertManager(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId);

      if (ticket.status !== "RECEIVED") {
        throw new ConflictError(
          "Only received tickets may be assigned",
          "TICKET_NOT_ASSIGNABLE",
        );
      }

      const active = await this.repository.findActiveByTicketForUpdate(
        connection,
        ticketId,
      );

      if (active) {
        throw new ConflictError(
          "Ticket already has an active assignment",
          "ACTIVE_ASSIGNMENT_EXISTS",
        );
      }

      const technician = await this.requireAssignableTechnician(
        connection,
        input.technicianId,
      );
      const assignmentId = await this.repository.create(connection, {
        ticketId,
        technicianId: technician.id,
        assignedBy: actor.id,
        note: input.note,
      });
      await this.tickets.updateStatus(connection, ticketId, "ASSIGNED");
      await this.tickets.createStatusHistory(connection, {
        ticketId,
        changedBy: actor.id,
        fromStatus: ticket.status,
        toStatus: "ASSIGNED",
        reason: input.note ?? `Assigned to technician ${technician.full_name}`,
      });
      await this.repository.createNotification(connection, {
        userId: technician.id,
        type: "TICKET_ASSIGNED",
        title: "New repair ticket assignment",
        content: `You were assigned repair ticket ${ticket.ticket_code}.`,
        ticketId,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "TICKET_ASSIGNED",
        entityType: "TICKET_ASSIGNMENT",
        entityId: assignmentId,
        newData: {
          ticketId,
          technicianId: technician.id,
          note: input.note ?? null,
        },
        ...requestMetadata,
      });

      return this.requireAssignment(connection, assignmentId);
    });
  }

  public async reassign(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: ReassignTicketDto,
    metadata: RequestMetadata,
  ): Promise<TicketAssignment> {
    this.assertManager(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId);

      if (ticket.status !== "ASSIGNED") {
        throw new ConflictError(
          "Ticket is not in a state that permits reassignment",
          "TICKET_NOT_REASSIGNABLE",
        );
      }

      const current = await this.repository.findActiveByTicketForUpdate(
        connection,
        ticketId,
      );

      if (!current) {
        throw new ConflictError(
          "Ticket does not have an active assignment",
          "ACTIVE_ASSIGNMENT_NOT_FOUND",
        );
      }

      if (current.technician_id === input.technicianId) {
        throw new ConflictError(
          "Ticket is already assigned to this technician",
          "TECHNICIAN_ALREADY_ASSIGNED",
        );
      }

      const technician = await this.requireAssignableTechnician(
        connection,
        input.technicianId,
      );
      await this.repository.deactivate(connection, current.id);
      const assignmentId = await this.repository.create(connection, {
        ticketId,
        technicianId: technician.id,
        assignedBy: actor.id,
        note: input.note,
      });
      await this.repository.createNotification(connection, {
        userId: current.technician_id,
        type: "TICKET_UNASSIGNED",
        title: "Repair ticket reassigned",
        content: `Repair ticket ${ticket.ticket_code} was reassigned to another technician.`,
        ticketId,
      });
      await this.repository.createNotification(connection, {
        userId: technician.id,
        type: "TICKET_ASSIGNED",
        title: "New repair ticket assignment",
        content: `You were assigned repair ticket ${ticket.ticket_code}.`,
        ticketId,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "TICKET_REASSIGNED",
        entityType: "TICKET_ASSIGNMENT",
        entityId: assignmentId,
        oldData: {
          assignmentId: current.id,
          technicianId: current.technician_id,
        },
        newData: {
          ticketId,
          technicianId: technician.id,
          note: input.note,
        },
        ...requestMetadata,
      });

      return this.requireAssignment(connection, assignmentId);
    });
  }

  private assertManager(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "MANAGER") {
      throw new ForbiddenError("Only managers may assign technicians", "FORBIDDEN");
    }
  }

  private async requireTicket(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(connection, ticketId, true);

    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "TICKET_NOT_FOUND");
    }

    return ticket;
  }

  private async requireAssignableTechnician(
    connection: PoolConnection,
    technicianId: number,
  ): Promise<AssignableTechnicianRow> {
    const technician = await this.repository.findTechnicianForUpdate(
      connection,
      technicianId,
    );

    if (!technician || technician.role !== "TECHNICIAN") {
      throw new NotFoundError("Technician not found", "TECHNICIAN_NOT_FOUND");
    }

    if (
      technician.status !== "ACTIVE" ||
      (technician.locked_until !== null && technician.locked_until > new Date())
    ) {
      throw new ConflictError(
        "Technician is not available for assignment",
        "TECHNICIAN_NOT_AVAILABLE",
      );
    }

    return technician;
  }

  private async requireAssignment(
    connection: PoolConnection,
    assignmentId: number,
  ): Promise<TicketAssignment> {
    const assignment = await this.repository.findById(connection, assignmentId);

    if (!assignment) {
      throw new NotFoundError(
        "Created assignment could not be loaded",
        "ASSIGNMENT_NOT_FOUND",
      );
    }

    return toTicketAssignment(assignment);
  }
}

export const ticketAssignmentService = new TicketAssignmentService();
