import type { Pool, PoolConnection } from "mysql2/promise";
import { ALLOWED_TICKET_TRANSITIONS, type TicketStatus } from "../../common/constants/ticket-status.js";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import { auditLogRepository, type AuditLogRepository } from "../../common/repositories/audit-log.repository.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import { repairTicketRepository, type RepairTicketRepository } from "../repair-tickets/repair-ticket.repository.js";
import type { CloseDeliveryDto, CreateDeliveryDto } from "./delivery.dto.js";
import { toDelivery, type Delivery, type DeliveryClosureResult } from "./delivery.model.js";
import { deliveryRepository, type DeliveryRepository } from "./delivery.repository.js";

type TransactionRunner = <T>(callback: (connection: PoolConnection) => Promise<T>) => Promise<T>;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class DeliveryService {
  public constructor(
    private readonly repository: DeliveryRepository = deliveryRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async get(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<Delivery> {
    const ticket = await this.requireTicket(ticketId);
    if (
      actor.role !== "RECEPTIONIST" &&
      actor.role !== "MANAGER" &&
      !(actor.role === "CUSTOMER" && actor.id === ticket.customer_id)
    ) {
      throw new ForbiddenError(
        "You are not allowed to view this delivery",
        "DELIVERY_ACCESS_DENIED",
      );
    }
    const delivery = await this.repository.findByTicket(pool, ticketId);
    if (!delivery) {
      throw new NotFoundError("Delivery not found", "DELIVERY_NOT_FOUND");
    }
    return toDelivery(delivery);
  }

  public async deliver(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateDeliveryDto,
    metadata: RequestMetadata,
  ): Promise<Delivery> {
    if (actor.role !== "RECEPTIONIST" && actor.role !== "MANAGER") {
      throw new ForbiddenError("Only delivery staff may hand over devices", "FORBIDDEN");
    }
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      let ticket = await this.requireTicket(ticketId, connection, true);
      if (await this.repository.findByTicket(connection, ticketId)) {
        throw new ConflictError("This ticket was already delivered", "DELIVERY_ALREADY_EXISTS");
      }
      const invoice = await this.repository.findInvoiceForUpdate(connection, ticketId);
      const invoicePaid = invoice !== null &&
        Math.round(invoice.paid_amount * 100) === Math.round(invoice.total_amount * 100) &&
        invoice.payment_status === "PAID";
      const rejectedReturn = ticket.status === "CUSTOMER_REJECTED";
      const usesPaymentException = !rejectedReturn && !invoicePaid;

      if (ticket.status === "CUSTOMER_REJECTED") {
        if (actor.role !== "RECEPTIONIST") {
          throw new ForbiddenError(
            "Receptionists return devices after a rejected quotation",
            "RECEPTIONIST_DELIVERY_REQUIRED",
          );
        }
        await this.transition(
          connection,
          actor.id,
          ticket,
          "READY_FOR_DELIVERY",
          "Customer rejected quotation; device prepared for return",
        );
        ticket = { ...ticket, status: "READY_FOR_DELIVERY" };
      } else if (ticket.status === "COMPLETED" && usesPaymentException) {
        if (actor.role !== "MANAGER" || !input.paymentExceptionReason) {
          throw new ForbiddenError(
            "An explicit Manager payment exception is required",
            "DELIVERY_PAYMENT_EXCEPTION_REQUIRED",
          );
        }
        await this.transition(
          connection,
          actor.id,
          ticket,
          "READY_FOR_DELIVERY",
          `Manager payment exception: ${input.paymentExceptionReason}`,
        );
        ticket = { ...ticket, status: "READY_FOR_DELIVERY" };
      }

      if (ticket.status !== "READY_FOR_DELIVERY") {
        throw new ConflictError(
          "Ticket is not ready for delivery",
          "TICKET_NOT_READY_FOR_DELIVERY",
        );
      }
      if (usesPaymentException) {
        if (actor.role !== "MANAGER" || !input.paymentExceptionReason) {
          throw new ForbiddenError(
            "An explicit Manager payment exception is required",
            "DELIVERY_PAYMENT_EXCEPTION_REQUIRED",
          );
        }
      } else if (actor.role !== "RECEPTIONIST") {
        throw new ForbiddenError(
          "Paid device handover is performed by a receptionist",
          "RECEPTIONIST_DELIVERY_REQUIRED",
        );
      }

      const deliveryId = await this.repository.create(
        connection,
        ticketId,
        actor.id,
        input,
      );
      if (input.proofUrl) {
        await this.repository.createProofAttachment(
          connection,
          ticketId,
          actor.id,
          input.proofUrl,
        );
      }
      await this.transition(
        connection,
        actor.id,
        ticket,
        "DELIVERED",
        usesPaymentException
          ? `Delivered with Manager payment exception: ${input.paymentExceptionReason}`
          : rejectedReturn
            ? "Unrepaired device returned to customer"
            : "Paid device handed over to recipient",
      );
      await this.repository.createNotification(
        connection,
        ticket.customer_id,
        ticket.id,
        ticket.ticket_code,
      );
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: usesPaymentException
          ? "DEVICE_DELIVERED_WITH_PAYMENT_EXCEPTION"
          : "DEVICE_DELIVERED",
        entityType: "DELIVERY",
        entityId: deliveryId,
        oldData: { ticketStatus: ticket.status, invoiceStatus: invoice?.payment_status ?? null },
        newData: {
          ticketStatus: "DELIVERED",
          recipientName: input.recipientName,
          proofProvided: Boolean(input.proofUrl),
          paymentExceptionReason: input.paymentExceptionReason ?? null,
        },
        ...requestMetadata,
      });
      const delivery = await this.repository.findByTicket(connection, ticketId);
      if (!delivery) throw new NotFoundError("Delivery not found", "DELIVERY_NOT_FOUND");
      return toDelivery(delivery);
    });
  }

  public async close(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CloseDeliveryDto,
    metadata: RequestMetadata,
  ): Promise<DeliveryClosureResult> {
    if (actor.role !== "RECEPTIONIST" && actor.role !== "MANAGER") {
      throw new ForbiddenError("Only operational staff may close delivered tickets", "FORBIDDEN");
    }
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(ticketId, connection, true);
      if (ticket.status !== "DELIVERED") {
        throw new ConflictError("Only delivered tickets may be closed", "TICKET_NOT_DELIVERED");
      }
      if (!await this.repository.findByTicket(connection, ticketId)) {
        throw new ConflictError("A delivery record is required before closure", "DELIVERY_REQUIRED");
      }
      const reason = input.reason ?? "Delivery completed and ticket closed";
      await this.transition(connection, actor.id, ticket, "CLOSED", reason);
      await this.repository.createClosedNotification(
        connection, ticket.customer_id, ticket.id, ticket.ticket_code,
      );
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "REPAIR_TICKET_CLOSED",
        entityType: "REPAIR_TICKET",
        entityId: ticketId,
        oldData: { status: "DELIVERED" },
        newData: { status: "CLOSED", reason },
        ...requestMetadata,
      });
      return { ticketId, status: "CLOSED" };
    });
  }

  private async requireTicket(
    ticketId: number,
    executor: Pool | PoolConnection = pool,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(executor, ticketId, lockForUpdate);
    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "REPAIR_TICKET_NOT_FOUND");
    }
    return ticket;
  }

  private async transition(
    connection: PoolConnection,
    actorId: number,
    ticket: RepairTicketRow,
    targetStatus: TicketStatus,
    reason: string,
  ): Promise<void> {
    if (!ALLOWED_TICKET_TRANSITIONS[ticket.status].includes(targetStatus)) {
      throw new ConflictError(
        `Ticket cannot transition from ${ticket.status} to ${targetStatus}`,
        "INVALID_TICKET_TRANSITION",
      );
    }
    await this.tickets.updateStatus(connection, ticket.id, targetStatus);
    await this.tickets.createStatusHistory(connection, {
      ticketId: ticket.id,
      changedBy: actorId,
      fromStatus: ticket.status,
      toStatus: targetStatus,
      reason,
    });
  }
}

export const deliveryService = new DeliveryService();
