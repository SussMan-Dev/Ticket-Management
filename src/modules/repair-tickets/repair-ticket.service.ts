import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  ALLOWED_TICKET_TRANSITIONS,
  type TicketStatus,
} from "../../common/constants/ticket-status.js";
import { BadRequestError } from "../../common/errors/bad-request-error.js";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type {
  CreateRepairTicketDto,
  CreateTicketAttachmentDto,
  ListRepairTicketsQuery,
  ListRepairTicketsResult,
  UpdateRepairTicketDto,
} from "./repair-ticket.dto.js";
import {
  toRepairTicket,
  toTicketAttachment,
  toTicketStatusHistory,
  type RepairTicket,
  type RepairTicketRow,
  type TicketAttachment,
  type TicketAttachmentType,
  type TicketStatusHistory,
} from "./repair-ticket.model.js";
import {
  repairTicketRepository,
  type RepairTicketRepository,
} from "./repair-ticket.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

const TICKET_STAFF_ROLES = new Set(["RECEPTIONIST", "MANAGER"]);
const TERMINAL_TICKET_STATUSES = new Set<TicketStatus>(["CLOSED", "CANCELLED"]);
const PHASE_FOUR_MANAGER_TRANSITIONS = new Set([
  "RECEIVED:ON_HOLD",
  "ON_HOLD:RECEIVED",
]);

function isTicketStaff(actor: Express.AuthenticatedUser): boolean {
  return TICKET_STAFF_ROLES.has(actor.role);
}

function assertCustomerOrStaffScope(
  actor: Express.AuthenticatedUser,
  customerId: number,
): void {
  if (isTicketStaff(actor)) {
    return;
  }

  if (actor.role !== "CUSTOMER" || actor.id !== customerId) {
    throw new ForbiddenError("You may access only your own repair tickets", "FORBIDDEN");
  }
}

function formatTicketCode(ticketId: number, now = new Date()): string {
  return `RT-${now.getUTCFullYear()}-${String(ticketId).padStart(6, "0")}`;
}

function isAllowedTransition(fromStatus: TicketStatus, toStatus: TicketStatus): boolean {
  const allowed: readonly TicketStatus[] = ALLOWED_TICKET_TRANSITIONS[fromStatus];
  return allowed.includes(toStatus);
}

export class RepairTicketService {
  public constructor(
    private readonly repository: RepairTicketRepository = repairTicketRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    query: ListRepairTicketsQuery,
  ): Promise<ListRepairTicketsResult> {
    let scopedQuery: ListRepairTicketsQuery;

    if (actor.role === "CUSTOMER") {
      if (query.customerId !== undefined && query.customerId !== actor.id) {
        throw new ForbiddenError("You may access only your own repair tickets", "FORBIDDEN");
      }

      scopedQuery = { ...query, customerId: actor.id };
    } else if (actor.role === "TECHNICIAN") {
      scopedQuery = { ...query, assignedTechnicianId: actor.id };
    } else if (actor.role === "CASHIER") {
      if (query.status !== undefined && query.status !== "COMPLETED") {
        throw new ForbiddenError(
          "Cashiers may list only completed tickets awaiting billing",
          "BILLING_TICKET_SCOPE_REQUIRED",
        );
      }
      scopedQuery = { ...query, status: "COMPLETED" };
    } else if (isTicketStaff(actor)) {
      scopedQuery = query;
    } else {
      throw new ForbiddenError("You are not allowed to view repair tickets", "FORBIDDEN");
    }

    const result = await this.repository.list(scopedQuery);
    return {
      tickets: result.rows.map(toRepairTicket),
      total: result.total,
    };
  }

  public async listForCustomer(
    actor: Express.AuthenticatedUser,
    customerId: number,
    query: Omit<ListRepairTicketsQuery, "customerId" | "assignedTechnicianId">,
  ): Promise<ListRepairTicketsResult> {
    assertCustomerOrStaffScope(actor, customerId);
    const customer = await this.repository.findCustomer(pool, customerId);

    if (!customer) {
      throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    return this.list(actor, { ...query, customerId });
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<RepairTicket> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertTicketVisibility(pool, actor, ticket);
    return toRepairTicket(ticket);
  }

  public async create(
    actor: Express.AuthenticatedUser,
    input: CreateRepairTicketDto,
  ): Promise<RepairTicket> {
    let customerId: number;

    if (actor.role === "CUSTOMER") {
      if (input.customerId !== undefined && input.customerId !== actor.id) {
        throw new ForbiddenError("You may create tickets only for yourself", "FORBIDDEN");
      }

      if (input.receiveNow) {
        throw new ForbiddenError("Only receptionists may receive a ticket", "FORBIDDEN");
      }

      if (
        input.priority !== "NORMAL" ||
        input.expectedDiagnosisAt !== undefined ||
        input.expectedCompletionAt !== undefined
      ) {
        throw new ForbiddenError(
          "Ticket priority and expected dates are staff-managed",
          "STAFF_FIELDS_FORBIDDEN",
        );
      }

      customerId = actor.id;
    } else if (isTicketStaff(actor)) {
      if (input.customerId === undefined) {
        throw new BadRequestError(
          "customerId is required when staff create a ticket",
          "CUSTOMER_ID_REQUIRED",
        );
      }

      if (input.receiveNow && actor.role !== "RECEPTIONIST") {
        throw new ForbiddenError("Only receptionists may receive a ticket", "FORBIDDEN");
      }

      customerId = input.customerId;
    } else {
      throw new ForbiddenError("You are not allowed to create repair tickets", "FORBIDDEN");
    }

    return this.runInTransaction(async (connection) => {
      const device = await this.repository.findAvailableDeviceForCustomer(
        connection,
        input.deviceId,
        customerId,
      );

      if (!device) {
        throw new NotFoundError(
          "An active device owned by the customer was not found",
          "DEVICE_NOT_AVAILABLE",
        );
      }

      const initialStatus: TicketStatus = input.receiveNow ? "RECEIVED" : "NEW";
      const ticketId = await this.repository.create(connection, {
        placeholderCode: `TMP-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        customerId,
        deviceId: input.deviceId,
        createdBy: actor.id,
        title: input.title,
        customerIssue: input.customerIssue,
        initialCondition: input.initialCondition,
        accessoriesReceived: input.accessoriesReceived,
        status: initialStatus,
        priority: input.priority,
        expectedDiagnosisAt: input.expectedDiagnosisAt,
        expectedCompletionAt: input.expectedCompletionAt,
      });
      await this.repository.setTicketCode(
        connection,
        ticketId,
        formatTicketCode(ticketId),
      );
      await this.repository.createStatusHistory(connection, {
        ticketId,
        changedBy: actor.id,
        fromStatus: null,
        toStatus: initialStatus,
        reason: input.receiveNow ? "Created and received during intake" : "Ticket created",
      });

      const created = await this.repository.findById(connection, ticketId);

      if (!created) {
        throw new NotFoundError("Created ticket could not be loaded", "TICKET_NOT_FOUND");
      }

      return toRepairTicket(created);
    });
  }

  public async update(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: UpdateRepairTicketDto,
  ): Promise<RepairTicket> {
    return this.runInTransaction(async (connection) => {
      const current = await this.requireTicket(connection, ticketId, true);

      if (actor.role === "CUSTOMER") {
        assertCustomerOrStaffScope(actor, current.customer_id);

        if (current.status !== "NEW") {
          throw new ConflictError(
            "Customers may update a ticket only while it is new",
            "TICKET_NOT_EDITABLE",
          );
        }

        if (
          input.priority !== undefined ||
          input.expectedDiagnosisAt !== undefined ||
          input.expectedCompletionAt !== undefined
        ) {
          throw new ForbiddenError(
            "Ticket priority and expected dates are staff-managed",
            "STAFF_FIELDS_FORBIDDEN",
          );
        }
      } else if (isTicketStaff(actor)) {
        if (!["NEW", "RECEIVED", "ON_HOLD"].includes(current.status)) {
          throw new ConflictError(
            "Ticket intake details can no longer be edited",
            "TICKET_NOT_EDITABLE",
          );
        }
      } else {
        throw new ForbiddenError("You are not allowed to update this ticket", "FORBIDDEN");
      }

      this.validateExpectedDates(current, input);
      await this.repository.update(connection, ticketId, input);
      const updated = await this.requireTicket(connection, ticketId);
      return toRepairTicket(updated);
    });
  }

  public async receive(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    reason?: string,
  ): Promise<RepairTicket> {
    if (actor.role !== "RECEPTIONIST") {
      throw new ForbiddenError("Only receptionists may receive tickets", "FORBIDDEN");
    }

    return this.runInTransaction(async (connection) => {
      const current = await this.requireTicket(connection, ticketId, true);
      return this.transition(connection, actor, current, "RECEIVED", reason);
    });
  }

  public async changeStatus(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    status: TicketStatus,
    reason?: string,
  ): Promise<RepairTicket> {
    if (actor.role !== "MANAGER") {
      throw new ForbiddenError("Only managers may perform this status change", "FORBIDDEN");
    }

    return this.runInTransaction(async (connection) => {
      const current = await this.requireTicket(connection, ticketId, true);
      const phaseTransition = `${current.status}:${status}`;

      if (!PHASE_FOUR_MANAGER_TRANSITIONS.has(phaseTransition)) {
        throw new ConflictError(
          "This transition belongs to a later workflow phase",
          "STATUS_TRANSITION_NOT_AVAILABLE",
        );
      }

      if (!reason) {
        throw new BadRequestError("A reason is required for hold changes", "REASON_REQUIRED");
      }

      return this.transition(connection, actor, current, status, reason);
    });
  }

  public async cancel(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    reason: string,
  ): Promise<RepairTicket> {
    if (actor.role !== "CUSTOMER" && actor.role !== "MANAGER") {
      throw new ForbiddenError("You are not allowed to cancel tickets", "FORBIDDEN");
    }

    return this.runInTransaction(async (connection) => {
      const current = await this.requireTicket(connection, ticketId, true);

      if (actor.role === "CUSTOMER") {
        assertCustomerOrStaffScope(actor, current.customer_id);

        if (current.status !== "NEW") {
          throw new ConflictError(
            "Customers may cancel only new tickets",
            "TICKET_CANNOT_BE_CANCELLED",
          );
        }
      }

      return this.transition(connection, actor, current, "CANCELLED", reason, reason);
    });
  }

  public async getStatusHistory(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<TicketStatusHistory[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertTicketVisibility(pool, actor, ticket);
    const rows = await this.repository.listStatusHistory(pool, ticketId);
    return rows.map(toTicketStatusHistory);
  }

  public async listAttachments(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<TicketAttachment[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertTicketVisibility(pool, actor, ticket);
    const rows = await this.repository.listAttachments(pool, ticketId);
    return rows.map(toTicketAttachment);
  }

  public async createAttachment(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateTicketAttachmentDto,
  ): Promise<TicketAttachment> {
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      await this.assertTicketVisibility(connection, actor, ticket);

      if (TERMINAL_TICKET_STATUSES.has(ticket.status)) {
        throw new ConflictError(
          "Attachments cannot be added to a terminal ticket",
          "TICKET_TERMINAL",
        );
      }

      this.assertAttachmentType(actor, input.attachmentType);
      const attachmentId = await this.repository.createAttachment(
        connection,
        ticketId,
        actor.id,
        input,
      );
      const created = await this.repository.findAttachmentById(connection, attachmentId);

      if (!created) {
        throw new NotFoundError(
          "Created attachment could not be loaded",
          "ATTACHMENT_NOT_FOUND",
        );
      }

      return toTicketAttachment(created);
    });
  }

  private async requireTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.repository.findById(executor, ticketId, lockForUpdate);

    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "TICKET_NOT_FOUND");
    }

    return ticket;
  }

  private async assertTicketVisibility(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
  ): Promise<void> {
    if (isTicketStaff(actor)) {
      return;
    }

    if (actor.role === "CUSTOMER" && actor.id === ticket.customer_id) {
      return;
    }

    if (
      actor.role === "TECHNICIAN" &&
      await this.repository.hasActiveAssignment(executor, ticket.id, actor.id)
    ) {
      return;
    }

    throw new ForbiddenError("You are not allowed to access this ticket", "FORBIDDEN");
  }

  private async transition(
    connection: PoolConnection,
    actor: Express.AuthenticatedUser,
    current: RepairTicketRow,
    targetStatus: TicketStatus,
    reason?: string,
    cancellationReason: string | null = null,
  ): Promise<RepairTicket> {
    if (!isAllowedTransition(current.status, targetStatus)) {
      throw new ConflictError(
        `Ticket cannot transition from ${current.status} to ${targetStatus}`,
        "INVALID_STATUS_TRANSITION",
      );
    }

    await this.repository.updateStatus(
      connection,
      current.id,
      targetStatus,
      cancellationReason,
    );
    await this.repository.createStatusHistory(connection, {
      ticketId: current.id,
      changedBy: actor.id,
      fromStatus: current.status,
      toStatus: targetStatus,
      reason,
    });
    const updated = await this.requireTicket(connection, current.id);
    return toRepairTicket(updated);
  }

  private validateExpectedDates(
    current: RepairTicketRow,
    input: UpdateRepairTicketDto,
  ): void {
    const expectedDiagnosisAt = input.expectedDiagnosisAt === undefined
      ? current.expected_diagnosis_at
      : input.expectedDiagnosisAt;
    const expectedCompletionAt = input.expectedCompletionAt === undefined
      ? current.expected_completion_at
      : input.expectedCompletionAt;

    if (
      expectedDiagnosisAt &&
      expectedCompletionAt &&
      expectedCompletionAt <= expectedDiagnosisAt
    ) {
      throw new BadRequestError(
        "Expected completion must be after expected diagnosis",
        "INVALID_EXPECTED_DATES",
      );
    }
  }

  private assertAttachmentType(
    actor: Express.AuthenticatedUser,
    attachmentType: TicketAttachmentType,
  ): void {
    const allowedByRole: Partial<Record<Express.AuthenticatedUser["role"], Set<TicketAttachmentType>>> = {
      CUSTOMER: new Set(["CUSTOMER_ATTACHMENT"]),
      RECEPTIONIST: new Set(["BEFORE_REPAIR", "CUSTOMER_ATTACHMENT"]),
      TECHNICIAN: new Set(["DURING_REPAIR", "AFTER_REPAIR"]),
      MANAGER: new Set([
        "BEFORE_REPAIR",
        "DURING_REPAIR",
        "AFTER_REPAIR",
        "CUSTOMER_ATTACHMENT",
      ]),
    };

    if (!allowedByRole[actor.role]?.has(attachmentType)) {
      throw new ForbiddenError(
        "This attachment type is not allowed for your role",
        "ATTACHMENT_TYPE_FORBIDDEN",
      );
    }
  }
}

export const repairTicketService = new RepairTicketService();
