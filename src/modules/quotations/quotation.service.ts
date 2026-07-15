import type { Pool, PoolConnection } from "mysql2/promise";
import type { TicketStatus } from "../../common/constants/ticket-status.js";
import { BadRequestError } from "../../common/errors/bad-request-error.js";
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
import type {
  CreateQuotationDto,
  QuotationItemDto,
  UpdateQuotationDto,
} from "./quotation.dto.js";
import {
  toQuotation,
  type ApprovedDiagnosisSnapshotRow,
  type CatalogPartSnapshotRow,
  type Quotation,
  type QuotationItemRecord,
  type QuotationItemRow,
  type QuotationRow,
} from "./quotation.model.js";
import {
  quotationRepository,
  type QuotationAmounts,
  type QuotationRepository,
} from "./quotation.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

const MAX_MONEY = 9_999_999_999.99;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function partDescription(part: CatalogPartSnapshotRow): string {
  return `${part.sku} - ${part.name}`.slice(0, 500);
}

export class QuotationService {
  public constructor(
    private readonly repository: QuotationRepository = quotationRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<Quotation[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(pool, actor, ticket);
    const rows = await this.repository.listByTicket(
      pool,
      ticketId,
      actor.role === "CUSTOMER",
    );
    return this.hydrate(pool, rows);
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    quotationId: number,
  ): Promise<Quotation> {
    const row = await this.requireQuotation(pool, quotationId);
    const ticket = await this.requireTicket(pool, row.ticket_id);
    await this.assertReadScope(pool, actor, ticket);
    if (actor.role === "CUSTOMER" && row.sent_at === null) {
      throw new NotFoundError("Quotation not found", "QUOTATION_NOT_FOUND");
    }
    return this.requireHydratedQuotation(pool, quotationId);
  }

  public async create(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateQuotationDto,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    this.assertManagerRole(actor);
    this.assertFutureExpiry(input.expiresAt);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      let ticket = await this.requireTicket(connection, ticketId, true);
      let current = await this.repository.findCurrentByTicketForUpdate(
        connection,
        ticketId,
      );

      if (current?.status === "SENT" && this.isExpired(current)) {
        await this.expireQuotation(connection, actor, ticket, current, requestMetadata);
        if (ticket.status === "WAITING_FOR_CUSTOMER_APPROVAL") {
          ticket = { ...ticket, status: "WAITING_FOR_QUOTATION" };
        }
        current = null;
      }

      if (ticket.status !== "WAITING_FOR_QUOTATION") {
        throw new ConflictError(
          "Ticket is not ready for a quotation",
          "TICKET_NOT_QUOTABLE",
        );
      }

      if (current?.status === "SENT") {
        throw new ConflictError(
          "The current quotation is still awaiting customer response",
          "ACTIVE_QUOTATION_EXISTS",
        );
      }

      const diagnosis = await this.repository.findApprovedDiagnosisForUpdate(
        connection,
        ticketId,
      );
      if (!diagnosis) {
        throw new ConflictError(
          "An approved diagnosis is required before creating a quotation",
          "APPROVED_DIAGNOSIS_REQUIRED",
        );
      }

      const items = await this.buildDiagnosisSnapshot(connection, diagnosis);
      const amounts = this.calculateAmounts(items);

      if (current) {
        await this.repository.updateStatus(connection, current.id, "SUPERSEDED");
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "QUOTATION_SUPERSEDED",
          entityType: "QUOTATION",
          entityId: current.id,
          oldData: { status: current.status, version: current.version },
          newData: { status: "SUPERSEDED" },
          ...requestMetadata,
        });
      }

      const version = await this.repository.nextVersion(connection, ticketId);
      const quotationId = await this.repository.create(connection, {
        ticketId,
        diagnosisId: diagnosis.id,
        version,
        expiresAt: input.expiresAt ?? null,
        createdBy: actor.id,
        ...amounts,
      });
      await this.repository.replaceItems(connection, quotationId, items);
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "QUOTATION_CREATED",
        entityType: "QUOTATION",
        entityId: quotationId,
        newData: {
          ticketId,
          diagnosisId: diagnosis.id,
          version,
          totalAmount: amounts.totalAmount,
          itemCount: items.length,
        },
        ...requestMetadata,
      });

      return this.requireHydratedQuotation(connection, quotationId);
    });
  }

  public async update(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    input: UpdateQuotationDto,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    this.assertManagerRole(actor);
    this.assertFutureExpiry(input.expiresAt);
    const reference = await this.requireQuotation(pool, quotationId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireQuotation(connection, quotationId, true);
      if (ticket.status !== "WAITING_FOR_QUOTATION") {
        throw new ConflictError(
          "Ticket is not waiting for a quotation",
          "TICKET_NOT_QUOTABLE",
        );
      }
      if (current.status !== "DRAFT") {
        throw new ConflictError(
          "Only a draft quotation may be edited",
          "QUOTATION_NOT_EDITABLE",
        );
      }

      const items = input.items
        ? await this.buildCustomSnapshot(connection, input.items)
        : await this.loadItemRecords(connection, quotationId);
      const amounts = this.calculateAmounts(items);
      const expiresAt = input.expiresAt === undefined
        ? current.expires_at
        : input.expiresAt;

      await this.repository.updateDraft(connection, quotationId, expiresAt, amounts);
      if (input.items) {
        await this.repository.replaceItems(connection, quotationId, items);
      }
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "QUOTATION_UPDATED",
        entityType: "QUOTATION",
        entityId: quotationId,
        oldData: { status: current.status, totalAmount: current.total_amount },
        newData: {
          fields: Object.keys(input),
          totalAmount: amounts.totalAmount,
          itemCount: items.length,
        },
        ...requestMetadata,
      });
      return this.requireHydratedQuotation(connection, quotationId);
    });
  }

  public async submit(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    return this.managerStatusAction(
      actor,
      quotationId,
      "DRAFT",
      "PENDING_APPROVAL",
      reason,
      metadata,
      "QUOTATION_SUBMITTED",
    );
  }

  public async approve(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    this.assertManagerRole(actor);
    const reference = await this.requireQuotation(pool, quotationId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireQuotation(connection, quotationId, true);
      this.assertQuotationActionState(ticket, current, "PENDING_APPROVAL");

      await this.repository.approve(connection, quotationId, actor.id);
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        "APPROVED",
        reason,
        requestMetadata,
        "QUOTATION_APPROVED",
      );
      return this.requireHydratedQuotation(connection, quotationId);
    });
  }

  public async send(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    this.assertManagerRole(actor);
    const reference = await this.requireQuotation(pool, quotationId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireQuotation(connection, quotationId, true);
      this.assertQuotationActionState(ticket, current, "APPROVED");
      if (!current.expires_at || current.expires_at.getTime() <= this.now().getTime()) {
        throw new ConflictError(
          "A future expiration time is required before sending",
          "QUOTATION_EXPIRY_REQUIRED",
        );
      }

      await this.repository.markSent(connection, quotationId);
      await this.transitionTicket(
        connection,
        actor.id,
        ticket,
        "WAITING_FOR_CUSTOMER_APPROVAL",
        reason ?? `Quotation version ${current.version} sent to customer`,
      );
      await this.repository.createNotification(connection, {
        userId: ticket.customer_id,
        type: "QUOTATION_SENT",
        title: "Quotation awaiting your response",
        content: `Quotation version ${current.version} for repair ticket ${ticket.ticket_code} is ready for review.`,
        ticketId: ticket.id,
      });
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        "SENT",
        reason,
        requestMetadata,
        "QUOTATION_SENT",
      );
      return this.requireHydratedQuotation(connection, quotationId);
    });
  }

  public async accept(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    note: string | null | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    return this.respond(actor, quotationId, "ACCEPTED", note, metadata);
  }

  public async reject(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    note: string | null | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    return this.respond(actor, quotationId, "REJECTED", note, metadata);
  }

  private async managerStatusAction(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    expectedStatus: "DRAFT",
    targetStatus: "PENDING_APPROVAL",
    reason: string | undefined,
    metadata: RequestMetadata,
    auditAction: string,
  ): Promise<Quotation> {
    this.assertManagerRole(actor);
    const reference = await this.requireQuotation(pool, quotationId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireQuotation(connection, quotationId, true);
      this.assertQuotationActionState(ticket, current, expectedStatus);
      await this.repository.updateStatus(connection, quotationId, targetStatus);
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        targetStatus,
        reason,
        requestMetadata,
        auditAction,
      );
      return this.requireHydratedQuotation(connection, quotationId);
    });
  }

  private async respond(
    actor: Express.AuthenticatedUser,
    quotationId: number,
    responseStatus: "ACCEPTED" | "REJECTED",
    note: string | null | undefined,
    metadata: RequestMetadata,
  ): Promise<Quotation> {
    this.assertCustomerRole(actor);
    const reference = await this.requireQuotation(pool, quotationId);
    const requestMetadata = normalizeMetadata(metadata);

    const result = await this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireQuotation(connection, quotationId, true);
      if (ticket.customer_id !== actor.id) {
        throw new ForbiddenError(
          "Only the ticket owner may respond to this quotation",
          "TICKET_OWNER_REQUIRED",
        );
      }
      if (current.status !== "SENT") {
        throw new ConflictError(
          "Only a sent quotation may receive a customer response",
          "QUOTATION_NOT_RESPONDABLE",
        );
      }
      if (this.isExpired(current)) {
        await this.expireQuotation(connection, actor, ticket, current, requestMetadata);
        return { expired: true as const, quotation: null };
      }
      if (ticket.status !== "WAITING_FOR_CUSTOMER_APPROVAL") {
        throw new ConflictError(
          "Ticket is not awaiting customer approval",
          "TICKET_NOT_AWAITING_CUSTOMER_APPROVAL",
        );
      }

      await this.repository.recordCustomerResponse(
        connection,
        quotationId,
        responseStatus,
        note ?? null,
      );
      const targetStatus: TicketStatus = responseStatus === "REJECTED"
        ? "CUSTOMER_REJECTED"
        : (await this.repository.countPartItems(connection, quotationId)) > 0
          ? "WAITING_FOR_PARTS"
          : "REPAIRING";
      await this.transitionTicket(
        connection,
        actor.id,
        ticket,
        targetStatus,
        `Customer ${responseStatus.toLowerCase()} quotation version ${current.version}`,
      );
      await this.notifyManagers(
        connection,
        ticket,
        `QUOTATION_${responseStatus}`,
        `Quotation ${responseStatus.toLowerCase()}`,
        `The customer ${responseStatus.toLowerCase()} quotation version ${current.version} for repair ticket ${ticket.ticket_code}.`,
      );
      await this.auditStatusChange(
        connection,
        actor.id,
        current,
        responseStatus,
        note ?? undefined,
        requestMetadata,
        `QUOTATION_${responseStatus}`,
      );
      return {
        expired: false as const,
        quotation: await this.requireHydratedQuotation(connection, quotationId),
      };
    });

    if (result.expired) {
      throw new ConflictError(
        "Quotation has expired; a new version is required",
        "QUOTATION_EXPIRED",
      );
    }
    return result.quotation;
  }

  private async expireQuotation(
    connection: PoolConnection,
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
    quotation: QuotationRow,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.repository.updateStatus(connection, quotation.id, "EXPIRED");
    if (ticket.status === "WAITING_FOR_CUSTOMER_APPROVAL") {
      await this.transitionTicket(
        connection,
        actor.id,
        ticket,
        "WAITING_FOR_QUOTATION",
        `Quotation version ${quotation.version} expired`,
      );
    }
    await this.notifyManagers(
      connection,
      ticket,
      "QUOTATION_EXPIRED",
      "Quotation expired",
      `Quotation version ${quotation.version} for repair ticket ${ticket.ticket_code} expired.`,
    );
    await this.auditStatusChange(
      connection,
      actor.id,
      quotation,
      "EXPIRED",
      "Expiration time reached",
      metadata,
      "QUOTATION_EXPIRED",
    );
  }

  private async buildDiagnosisSnapshot(
    connection: PoolConnection,
    diagnosis: ApprovedDiagnosisSnapshotRow,
  ): Promise<QuotationItemRecord[]> {
    const parts = await this.repository.listDiagnosisPartSnapshotsForUpdate(
      connection,
      diagnosis.id,
    );
    const laborDescription = `Labor - ${diagnosis.proposed_solution}`.slice(0, 500);
    return [
      {
        itemType: "LABOR",
        partId: null,
        description: laborDescription,
        quantity: 1,
        unitPrice: diagnosis.labor_cost,
        lineTotal: roundMoney(diagnosis.labor_cost),
      },
      ...parts.map((part) => ({
        itemType: "PART" as const,
        partId: part.id,
        description: partDescription(part),
        quantity: part.quantity ?? 0,
        unitPrice: part.selling_price,
        lineTotal: roundMoney((part.quantity ?? 0) * part.selling_price),
      })),
    ];
  }

  private async buildCustomSnapshot(
    connection: PoolConnection,
    inputItems: QuotationItemDto[],
  ): Promise<QuotationItemRecord[]> {
    const partIds = inputItems
      .filter((item): item is Extract<QuotationItemDto, { itemType: "PART" }> =>
        item.itemType === "PART")
      .map((item) => item.partId);
    const parts = await this.repository.findActiveCatalogPartsForUpdate(
      connection,
      partIds,
    );
    if (parts.length !== partIds.length) {
      throw new NotFoundError(
        "One or more active parts were not found",
        "PART_NOT_AVAILABLE",
      );
    }
    const partsById = new Map(parts.map((part) => [part.id, part]));

    return inputItems.map((item) => {
      if (item.itemType === "PART") {
        const part = partsById.get(item.partId);
        if (!part) {
          throw new NotFoundError("Active part not found", "PART_NOT_AVAILABLE");
        }
        return {
          itemType: "PART",
          partId: part.id,
          description: partDescription(part),
          quantity: item.quantity,
          unitPrice: part.selling_price,
          lineTotal: roundMoney(item.quantity * part.selling_price),
        };
      }
      return {
        itemType: item.itemType,
        partId: null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: roundMoney(item.quantity * item.unitPrice),
      };
    });
  }

  private calculateAmounts(items: QuotationItemRecord[]): QuotationAmounts {
    const sum = (types: Array<QuotationItemRecord["itemType"]>) =>
      roundMoney(items
        .filter((item) => types.includes(item.itemType))
        .reduce((total, item) => total + item.lineTotal, 0));
    const laborAmount = sum(["LABOR"]);
    const partsAmount = sum(["PART"]);
    const discountAmount = 0;
    const taxAmount = 0;
    const totalAmount = sum(["LABOR", "PART", "OTHER"]);

    if ([laborAmount, partsAmount, totalAmount].some((amount) => amount > MAX_MONEY)) {
      throw new BadRequestError(
        "Quotation amount exceeds the supported limit",
        "QUOTATION_AMOUNT_LIMIT_EXCEEDED",
      );
    }
    return { laborAmount, partsAmount, discountAmount, taxAmount, totalAmount };
  }

  private async loadItemRecords(
    executor: DatabaseExecutor,
    quotationId: number,
  ): Promise<QuotationItemRecord[]> {
    const rows = await this.repository.listItemsByQuotationIds(executor, [quotationId]);
    return rows.map((row) => ({
      itemType: row.item_type,
      partId: row.part_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
    }));
  }

  private assertQuotationActionState(
    ticket: RepairTicketRow,
    quotation: QuotationRow,
    expectedStatus: QuotationRow["status"],
  ): void {
    if (ticket.status !== "WAITING_FOR_QUOTATION") {
      throw new ConflictError(
        "Ticket is not waiting for a quotation",
        "TICKET_NOT_QUOTABLE",
      );
    }
    if (quotation.status !== expectedStatus) {
      throw new ConflictError(
        `Quotation must be ${expectedStatus.toLowerCase()} for this action`,
        "QUOTATION_INVALID_STATUS",
      );
    }
  }

  private assertManagerRole(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "MANAGER") {
      throw new ForbiddenError(
        "Only managers may modify quotations",
        "FORBIDDEN",
      );
    }
  }

  private assertCustomerRole(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError(
        "Only customers may respond to quotations",
        "FORBIDDEN",
      );
    }
  }

  private assertFutureExpiry(expiresAt: Date | null | undefined): void {
    if (expiresAt && expiresAt.getTime() <= this.now().getTime()) {
      throw new BadRequestError(
        "Quotation expiration time must be in the future",
        "QUOTATION_EXPIRY_INVALID",
      );
    }
  }

  private isExpired(quotation: QuotationRow): boolean {
    return quotation.expires_at !== null &&
      quotation.expires_at.getTime() <= this.now().getTime();
  }

  private async assertReadScope(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
  ): Promise<void> {
    if (actor.role === "MANAGER") return;
    if (actor.role === "CUSTOMER" && actor.id === ticket.customer_id) return;
    if (
      actor.role === "TECHNICIAN" &&
      await this.tickets.hasActiveAssignment(executor, ticket.id, actor.id)
    ) return;
    throw new ForbiddenError(
      "You are not allowed to view these quotations",
      "FORBIDDEN",
    );
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

  private async requireQuotation(
    executor: DatabaseExecutor,
    quotationId: number,
    lockForUpdate = false,
  ): Promise<QuotationRow> {
    const quotation = await this.repository.findById(
      executor,
      quotationId,
      lockForUpdate,
    );
    if (!quotation) {
      throw new NotFoundError("Quotation not found", "QUOTATION_NOT_FOUND");
    }
    return quotation;
  }

  private async hydrate(
    executor: DatabaseExecutor,
    rows: QuotationRow[],
  ): Promise<Quotation[]> {
    const itemRows = await this.repository.listItemsByQuotationIds(
      executor,
      rows.map((row) => row.id),
    );
    const itemsByQuotation = new Map<number, QuotationItemRow[]>();
    for (const item of itemRows) {
      const items = itemsByQuotation.get(item.quotation_id) ?? [];
      items.push(item);
      itemsByQuotation.set(item.quotation_id, items);
    }
    const now = this.now();
    return rows.map((row) =>
      toQuotation(row, itemsByQuotation.get(row.id) ?? [], now));
  }

  private async requireHydratedQuotation(
    executor: DatabaseExecutor,
    quotationId: number,
  ): Promise<Quotation> {
    const row = await this.requireQuotation(executor, quotationId);
    const [quotation] = await this.hydrate(executor, [row]);
    if (!quotation) {
      throw new NotFoundError("Quotation not found", "QUOTATION_NOT_FOUND");
    }
    return quotation;
  }

  private async transitionTicket(
    connection: PoolConnection,
    changedBy: number,
    ticket: RepairTicketRow,
    targetStatus: TicketStatus,
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

  private async notifyManagers(
    connection: PoolConnection,
    ticket: RepairTicketRow,
    type: string,
    title: string,
    content: string,
  ): Promise<void> {
    const managerIds = await this.repository.findActiveManagerIds(connection);
    for (const managerId of managerIds) {
      await this.repository.createNotification(connection, {
        userId: managerId,
        type,
        title,
        content,
        ticketId: ticket.id,
      });
    }
  }

  private async auditStatusChange(
    connection: PoolConnection,
    actorId: number,
    current: QuotationRow,
    targetStatus: QuotationRow["status"],
    reason: string | undefined,
    metadata: RequestMetadata,
    action: string,
  ): Promise<void> {
    await this.auditLogs.create(connection, {
      userId: actorId,
      action,
      entityType: "QUOTATION",
      entityId: current.id,
      oldData: { status: current.status },
      newData: { status: targetStatus, reason: reason ?? null },
      ...metadata,
    });
  }
}

export const quotationService = new QuotationService();
