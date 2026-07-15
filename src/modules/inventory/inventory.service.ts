import type { Pool, PoolConnection } from "mysql2/promise";
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
import {
  partRepository,
  type PartRepository,
} from "../parts/part.repository.js";
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import {
  repairTicketRepository,
  type RepairTicketRepository,
} from "../repair-tickets/repair-ticket.repository.js";
import type {
  CreatePartRequestDto,
  FulfillPartRequestDto,
  ListPartRequestsQuery,
  ListPartRequestsResult,
} from "./inventory.dto.js";
import {
  toPartRequest,
  type PartRequest,
  type PartRequestItemRow,
  type PartRequestRow,
} from "./inventory.model.js";
import {
  inventoryRepository,
  type InventoryRepository,
} from "./inventory.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class InventoryService {
  public constructor(
    private readonly repository: InventoryRepository = inventoryRepository,
    private readonly parts: PartRepository = partRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    query: ListPartRequestsQuery,
  ): Promise<ListPartRequestsResult> {
    this.assertReader(actor);
    const scopedQuery = actor.role === "TECHNICIAN"
      ? { ...query, requestedBy: actor.id }
      : query;
    const result = await this.repository.list(scopedQuery);
    return {
      requests: await this.hydrate(pool, result.rows),
      total: result.total,
    };
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    requestId: number,
  ): Promise<PartRequest> {
    this.assertReader(actor);
    const row = await this.requireRequest(pool, requestId);
    this.assertReadScope(actor, row);
    return this.requireHydratedRequest(pool, requestId);
  }

  public async create(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreatePartRequestDto,
    metadata: RequestMetadata,
  ): Promise<PartRequest> {
    this.assertTechnician(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      if (!await this.tickets.hasActiveAssignment(connection, ticketId, actor.id)) {
        throw new ForbiddenError(
          "An active ticket assignment is required",
          "ACTIVE_ASSIGNMENT_REQUIRED",
        );
      }
      if (ticket.status !== "WAITING_FOR_PARTS" && ticket.status !== "REPAIRING") {
        throw new ConflictError(
          "Ticket is not ready for a part request",
          "TICKET_NOT_REQUESTING_PARTS",
        );
      }

      const partIds = input.items.map((item) => item.partId);
      const activeParts = await this.parts.findByIdsForUpdate(
        connection,
        partIds,
        true,
      );
      if (activeParts.length !== partIds.length) {
        throw new NotFoundError(
          "One or more active parts were not found",
          "PART_NOT_AVAILABLE",
        );
      }

      const requestId = await this.repository.create(
        connection,
        ticketId,
        actor.id,
        input,
      );
      await this.repository.createItems(connection, requestId, input.items);
      if (ticket.status === "REPAIRING") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "WAITING_FOR_PARTS",
          `Part request ${requestId} created during repair`,
        );
      }
      const inventoryStaffIds = await this.repository.findActiveInventoryStaffIds(
        connection,
      );
      for (const userId of inventoryStaffIds) {
        await this.repository.createNotification(connection, {
          userId,
          type: "PART_REQUEST_CREATED",
          title: "Yêu cầu linh kiện đang chờ duyệt",
          content: `Yêu cầu linh kiện ${requestId} của phiếu sửa chữa ${ticket.ticket_code} đang chờ xét duyệt.`,
          ticketId,
        });
      }
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "PART_REQUEST_CREATED",
        entityType: "PART_REQUEST",
        entityId: requestId,
        newData: { ticketId, items: input.items },
        ...requestMetadata,
      });
      return this.requireHydratedRequest(connection, requestId);
    });
  }

  public async approve(
    actor: Express.AuthenticatedUser,
    requestId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<PartRequest> {
    this.assertInventoryStaff(actor);
    const reference = await this.requireRequest(pool, requestId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireRequest(connection, requestId, true);
      if (ticket.status !== "WAITING_FOR_PARTS") {
        throw new ConflictError(
          "Ticket is not waiting for parts",
          "TICKET_NOT_WAITING_FOR_PARTS",
        );
      }
      if (current.status !== "PENDING") {
        throw new ConflictError(
          "Only a pending part request may be approved",
          "PART_REQUEST_NOT_APPROVABLE",
        );
      }
      await this.repository.approve(connection, requestId, actor.id);
      await this.notifyRequester(
        connection,
        current,
        ticket,
        "PART_REQUEST_APPROVED",
        "Yêu cầu linh kiện đã được phê duyệt",
        `Yêu cầu linh kiện ${requestId} của phiếu sửa chữa ${ticket.ticket_code} đã được phê duyệt.`,
      );
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        "APPROVED",
        reason,
        requestMetadata,
        "PART_REQUEST_APPROVED",
      );
      return this.requireHydratedRequest(connection, requestId);
    });
  }

  public async reject(
    actor: Express.AuthenticatedUser,
    requestId: number,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<PartRequest> {
    this.assertInventoryStaff(actor);
    const reference = await this.requireRequest(pool, requestId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireRequest(connection, requestId, true);
      if (current.status !== "PENDING") {
        throw new ConflictError(
          "Only a pending part request may be rejected",
          "PART_REQUEST_NOT_REJECTABLE",
        );
      }
      await this.repository.updateStatus(connection, requestId, "REJECTED");
      await this.notifyRequester(
        connection,
        current,
        ticket,
        "PART_REQUEST_REJECTED",
        "Yêu cầu linh kiện đã bị từ chối",
        `Yêu cầu linh kiện ${requestId} của phiếu sửa chữa ${ticket.ticket_code} đã bị từ chối.`,
      );
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        "REJECTED",
        reason,
        requestMetadata,
        "PART_REQUEST_REJECTED",
      );
      return this.requireHydratedRequest(connection, requestId);
    });
  }

  public async fulfill(
    actor: Express.AuthenticatedUser,
    requestId: number,
    input: FulfillPartRequestDto,
    metadata: RequestMetadata,
  ): Promise<PartRequest> {
    this.assertInventoryStaff(actor);
    const reference = await this.requireRequest(pool, requestId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireRequest(connection, requestId, true);
      if (ticket.status !== "WAITING_FOR_PARTS") {
        throw new ConflictError(
          "Ticket is not waiting for parts",
          "TICKET_NOT_WAITING_FOR_PARTS",
        );
      }
      if (current.status !== "APPROVED" && current.status !== "PARTIALLY_FULFILLED") {
        throw new ConflictError(
          "Part request is not fulfillable",
          "PART_REQUEST_NOT_FULFILLABLE",
        );
      }

      const requestItems = await this.repository.listItemsByRequestIds(
        connection,
        [requestId],
        true,
      );
      const itemsByPartId = new Map(requestItems.map((item) => [item.part_id, item]));
      for (const item of input.items) {
        const requested = itemsByPartId.get(item.partId);
        if (!requested) {
          throw new NotFoundError(
            `Part ${item.partId} is not in this request`,
            "PART_REQUEST_ITEM_NOT_FOUND",
          );
        }
        if (item.quantity > requested.requested_quantity - requested.fulfilled_quantity) {
          throw new ConflictError(
            `Fulfillment exceeds the remaining quantity for part ${item.partId}`,
            "PART_REQUEST_OVER_FULFILLMENT",
          );
        }
      }

      const sortedInput = [...input.items].sort((a, b) => a.partId - b.partId);
      const partRows = await this.parts.findByIdsForUpdate(
        connection,
        sortedInput.map((item) => item.partId),
      );
      if (partRows.length !== sortedInput.length) {
        throw new NotFoundError("One or more parts were not found", "PART_NOT_FOUND");
      }
      const partsById = new Map(partRows.map((part) => [part.id, part]));
      const fulfilledNow = new Map<number, number>();
      for (const item of sortedInput) {
        const part = partsById.get(item.partId);
        if (!part) {
          throw new NotFoundError("Part not found", "PART_NOT_FOUND");
        }
        if (part.quantity_on_hand < item.quantity) {
          throw new ConflictError(
            `Insufficient stock for part ${part.sku}`,
            "INSUFFICIENT_STOCK",
            {
              partId: part.id,
              available: part.quantity_on_hand,
              requested: item.quantity,
            },
          );
        }
        const quantityAfter = part.quantity_on_hand - item.quantity;
        await this.parts.updateStock(connection, part.id, quantityAfter);
        await this.parts.createInventoryTransaction(connection, {
          partId: part.id,
          ticketId: ticket.id,
          transactionType: "STOCK_OUT",
          quantity: item.quantity,
          quantityBefore: part.quantity_on_hand,
          quantityAfter,
          referenceType: "PART_REQUEST",
          referenceId: requestId,
          performedBy: actor.id,
          note: input.note ?? `Fulfillment for part request ${requestId}`,
        });
        await this.repository.addFulfilledQuantity(
          connection,
          requestId,
          part.id,
          item.quantity,
        );
        fulfilledNow.set(part.id, item.quantity);
      }

      const isFullyFulfilled = requestItems.every((item) =>
        item.fulfilled_quantity + (fulfilledNow.get(item.part_id) ?? 0) >=
          item.requested_quantity);
      const targetStatus = isFullyFulfilled ? "FULFILLED" : "PARTIALLY_FULFILLED";
      await this.repository.updateStatus(connection, requestId, targetStatus);
      if (
        isFullyFulfilled &&
        !await this.repository.hasOtherOpenRequests(connection, ticket.id, requestId)
      ) {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "REPAIRING",
          `All open part requests fulfilled; request ${requestId} completed`,
        );
      }
      await this.notifyRequester(
        connection,
        current,
        ticket,
        isFullyFulfilled ? "PART_REQUEST_FULFILLED" : "PART_REQUEST_PARTIAL",
        isFullyFulfilled
          ? "Yêu cầu linh kiện đã được cấp đủ"
          : "Yêu cầu linh kiện đã được cấp một phần",
        isFullyFulfilled
          ? `Yêu cầu linh kiện ${requestId} của phiếu sửa chữa ${ticket.ticket_code} đã được cấp đủ.`
          : `Yêu cầu linh kiện ${requestId} của phiếu sửa chữa ${ticket.ticket_code} đã được cấp một phần.`,
      );
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        targetStatus,
        input.note ?? undefined,
        requestMetadata,
        isFullyFulfilled ? "PART_REQUEST_FULFILLED" : "PART_REQUEST_PARTIALLY_FULFILLED",
        { items: input.items },
      );
      return this.requireHydratedRequest(connection, requestId);
    });
  }

  private assertReader(actor: Express.AuthenticatedUser): void {
    if (!["TECHNICIAN", "INVENTORY_STAFF", "MANAGER"].includes(actor.role)) {
      throw new ForbiddenError("You are not allowed to view part requests", "FORBIDDEN");
    }
  }

  private assertTechnician(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "TECHNICIAN") {
      throw new ForbiddenError(
        "Only assigned technicians may create part requests",
        "FORBIDDEN",
      );
    }
  }

  private assertInventoryStaff(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "INVENTORY_STAFF") {
      throw new ForbiddenError(
        "Only inventory staff may process part requests",
        "FORBIDDEN",
      );
    }
  }

  private assertReadScope(
    actor: Express.AuthenticatedUser,
    request: PartRequestRow,
  ): void {
    if (actor.role === "TECHNICIAN" && request.requested_by !== actor.id) {
      throw new ForbiddenError(
        "Technicians may view only their own part requests",
        "FORBIDDEN",
      );
    }
  }

  private async requireTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(executor, ticketId, lockForUpdate);
    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "TICKET_NOT_FOUND");
    }
    return ticket;
  }

  private async requireRequest(
    executor: DatabaseExecutor,
    requestId: number,
    lockForUpdate = false,
  ): Promise<PartRequestRow> {
    const request = await this.repository.findById(executor, requestId, lockForUpdate);
    if (!request) {
      throw new NotFoundError("Part request not found", "PART_REQUEST_NOT_FOUND");
    }
    return request;
  }

  private async hydrate(
    executor: DatabaseExecutor,
    rows: PartRequestRow[],
  ): Promise<PartRequest[]> {
    const itemRows = await this.repository.listItemsByRequestIds(
      executor,
      rows.map((row) => row.id),
    );
    const itemsByRequest = new Map<number, PartRequestItemRow[]>();
    for (const item of itemRows) {
      const items = itemsByRequest.get(item.part_request_id) ?? [];
      items.push(item);
      itemsByRequest.set(item.part_request_id, items);
    }
    return rows.map((row) =>
      toPartRequest(row, itemsByRequest.get(row.id) ?? []));
  }

  private async requireHydratedRequest(
    executor: DatabaseExecutor,
    requestId: number,
  ): Promise<PartRequest> {
    const row = await this.requireRequest(executor, requestId);
    const [request] = await this.hydrate(executor, [row]);
    if (!request) {
      throw new NotFoundError("Part request not found", "PART_REQUEST_NOT_FOUND");
    }
    return request;
  }

  private async transitionTicket(
    connection: PoolConnection,
    changedBy: number,
    ticket: RepairTicketRow,
    targetStatus: "WAITING_FOR_PARTS" | "REPAIRING",
    reason: string,
  ): Promise<void> {
    await this.tickets.updateStatus(connection, ticket.id, targetStatus);
    await this.tickets.createStatusHistory(connection, {
      ticketId: ticket.id,
      changedBy,
      fromStatus: ticket.status,
      toStatus: targetStatus,
      reason,
    });
  }

  private async notifyRequester(
    connection: PoolConnection,
    request: PartRequestRow,
    ticket: RepairTicketRow,
    type: string,
    title: string,
    content: string,
  ): Promise<void> {
    await this.repository.createNotification(connection, {
      userId: request.requested_by,
      type,
      title,
      content,
      ticketId: ticket.id,
    });
  }

  private async auditStatusChange(
    connection: PoolConnection,
    actorId: number,
    current: PartRequestRow,
    targetStatus: PartRequestRow["status"],
    reason: string | undefined,
    metadata: RequestMetadata,
    action: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditLogs.create(connection, {
      userId: actorId,
      action,
      entityType: "PART_REQUEST",
      entityId: current.id,
      oldData: { status: current.status },
      newData: { status: targetStatus, reason: reason ?? null, ...extra },
      ...metadata,
    });
  }
}

export const inventoryService = new InventoryService();
