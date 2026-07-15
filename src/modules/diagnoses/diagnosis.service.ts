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
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import {
  repairTicketRepository,
  type RepairTicketRepository,
} from "../repair-tickets/repair-ticket.repository.js";
import type { CreateDiagnosisDto, DiagnosisPartDto, UpdateDiagnosisDto } from "./diagnosis.dto.js";
import {
  toCustomerDiagnosis,
  toDiagnosis,
  type CustomerDiagnosis,
  type Diagnosis,
  type DiagnosisPartRow,
  type DiagnosisRow,
} from "./diagnosis.model.js";
import {
  diagnosisRepository,
  type DiagnosisRepository,
} from "./diagnosis.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;
type DiagnosisView = Diagnosis | CustomerDiagnosis;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class DiagnosisService {
  public constructor(
    private readonly repository: DiagnosisRepository = diagnosisRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<DiagnosisView[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(pool, actor, ticket);
    const customerView = actor.role === "CUSTOMER";
    const rows = await this.repository.listByTicket(pool, ticketId, customerView);
    const diagnoses = await this.hydrate(pool, rows);
    return customerView ? diagnoses.map(toCustomerDiagnosis) : diagnoses;
  }

  public async create(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateDiagnosisDto,
    metadata: RequestMetadata,
  ): Promise<Diagnosis> {
    this.assertTechnicianRole(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      await this.assertActiveAssignee(connection, actor, ticketId);

      if (ticket.status !== "ASSIGNED" && ticket.status !== "DIAGNOSING") {
        throw new ConflictError(
          "Ticket is not ready for diagnosis",
          "TICKET_NOT_DIAGNOSABLE",
        );
      }

      const openDiagnosis = await this.repository.findOpenByTicketForUpdate(
        connection,
        ticketId,
      );
      if (openDiagnosis) {
        throw new ConflictError(
          "Ticket already has an open diagnosis",
          "OPEN_DIAGNOSIS_EXISTS",
        );
      }

      await this.validateParts(connection, input.parts);
      const diagnosisId = await this.repository.create(
        connection,
        ticketId,
        actor.id,
        input,
      );
      await this.repository.replaceParts(connection, diagnosisId, input.parts);

      if (ticket.status === "ASSIGNED") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "DIAGNOSING",
          `Diagnosis ${diagnosisId} started`,
        );
      }

      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "DIAGNOSIS_CREATED",
        entityType: "DIAGNOSIS",
        entityId: diagnosisId,
        newData: { ticketId, partCount: input.parts.length },
        ...requestMetadata,
      });

      return this.requireHydratedDiagnosis(connection, diagnosisId);
    });
  }

  public async update(
    actor: Express.AuthenticatedUser,
    diagnosisId: number,
    input: UpdateDiagnosisDto,
    metadata: RequestMetadata,
  ): Promise<Diagnosis> {
    this.assertTechnicianRole(actor);
    const reference = await this.requireDiagnosis(pool, diagnosisId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireDiagnosis(connection, diagnosisId, true);
      this.assertDiagnosisAuthor(actor, current);
      await this.assertActiveAssignee(connection, actor, ticket.id);

      if (ticket.status !== "DIAGNOSING") {
        throw new ConflictError(
          "Ticket is not in the diagnosing state",
          "TICKET_NOT_DIAGNOSABLE",
        );
      }

      if (current.status !== "DRAFT" && current.status !== "REVISION_REQUIRED") {
        throw new ConflictError(
          "Diagnosis is not editable",
          "DIAGNOSIS_NOT_EDITABLE",
        );
      }

      if (input.parts) {
        await this.validateParts(connection, input.parts);
      }

      await this.repository.update(connection, diagnosisId, input);
      if (input.parts) {
        await this.repository.replaceParts(connection, diagnosisId, input.parts);
      }
      if (current.status === "REVISION_REQUIRED") {
        await this.repository.markDraft(connection, diagnosisId);
      }

      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "DIAGNOSIS_UPDATED",
        entityType: "DIAGNOSIS",
        entityId: diagnosisId,
        oldData: { status: current.status },
        newData: {
          fields: Object.keys(input),
          status: current.status === "REVISION_REQUIRED" ? "DRAFT" : current.status,
        },
        ...requestMetadata,
      });

      return this.requireHydratedDiagnosis(connection, diagnosisId);
    });
  }

  public async submit(
    actor: Express.AuthenticatedUser,
    diagnosisId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<Diagnosis> {
    this.assertTechnicianRole(actor);
    const reference = await this.requireDiagnosis(pool, diagnosisId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireDiagnosis(connection, diagnosisId, true);
      this.assertDiagnosisAuthor(actor, current);
      await this.assertActiveAssignee(connection, actor, ticket.id);

      if (current.status !== "DRAFT") {
        throw new ConflictError(
          "Only a draft diagnosis may be submitted",
          "DIAGNOSIS_NOT_SUBMITTABLE",
        );
      }

      if (ticket.status !== "DIAGNOSING") {
        throw new ConflictError(
          "Ticket is not in the diagnosing state",
          "TICKET_NOT_DIAGNOSABLE",
        );
      }

      await this.repository.markSubmitted(connection, diagnosisId);
      await this.transitionTicket(
        connection,
        actor.id,
        ticket,
        "WAITING_FOR_QUOTATION",
        reason ?? `Diagnosis ${diagnosisId} submitted for manager review`,
      );
      const managerIds = await this.repository.findActiveManagerIds(connection);
      for (const managerId of managerIds) {
        await this.repository.createNotification(connection, {
          userId: managerId,
          type: "DIAGNOSIS_SUBMITTED",
          title: "Chẩn đoán đang chờ duyệt",
          content: `Bản chẩn đoán của phiếu sửa chữa ${ticket.ticket_code} đã sẵn sàng để xét duyệt.`,
          ticketId: ticket.id,
        });
      }
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "DIAGNOSIS_SUBMITTED",
        entityType: "DIAGNOSIS",
        entityId: diagnosisId,
        oldData: { status: current.status },
        newData: { status: "SUBMITTED", reason: reason ?? null },
        ...requestMetadata,
      });

      return this.requireHydratedDiagnosis(connection, diagnosisId);
    });
  }

  public async requestRevision(
    actor: Express.AuthenticatedUser,
    diagnosisId: number,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<Diagnosis> {
    this.assertManagerRole(actor);
    const reference = await this.requireDiagnosis(pool, diagnosisId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireDiagnosis(connection, diagnosisId, true);

      if (current.status !== "SUBMITTED") {
        throw new ConflictError(
          "Only a submitted diagnosis may require revision",
          "DIAGNOSIS_NOT_REVIEWABLE",
        );
      }

      if (ticket.status !== "WAITING_FOR_QUOTATION") {
        throw new ConflictError(
          "Ticket is not waiting for diagnosis review",
          "TICKET_NOT_AWAITING_DIAGNOSIS_REVIEW",
        );
      }

      await this.repository.markRevisionRequired(connection, diagnosisId);
      await this.transitionTicket(
        connection,
        actor.id,
        ticket,
        "DIAGNOSING",
        reason,
      );
      await this.repository.createNotification(connection, {
        userId: current.technician_id,
        type: "DIAGNOSIS_REVISION_REQUIRED",
        title: "Yêu cầu chỉnh sửa chẩn đoán",
        content: `Bản chẩn đoán của phiếu sửa chữa ${ticket.ticket_code} cần được chỉnh sửa.`,
        ticketId: ticket.id,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "DIAGNOSIS_REVISION_REQUESTED",
        entityType: "DIAGNOSIS",
        entityId: diagnosisId,
        oldData: { status: current.status },
        newData: { status: "REVISION_REQUIRED", reason },
        ...requestMetadata,
      });

      return this.requireHydratedDiagnosis(connection, diagnosisId);
    });
  }

  public async approve(
    actor: Express.AuthenticatedUser,
    diagnosisId: number,
    reason: string | undefined,
    metadata: RequestMetadata,
  ): Promise<Diagnosis> {
    this.assertManagerRole(actor);
    const reference = await this.requireDiagnosis(pool, diagnosisId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireDiagnosis(connection, diagnosisId, true);

      if (current.status !== "SUBMITTED") {
        throw new ConflictError(
          "Only a submitted diagnosis may be approved",
          "DIAGNOSIS_NOT_REVIEWABLE",
        );
      }

      if (ticket.status !== "WAITING_FOR_QUOTATION") {
        throw new ConflictError(
          "Ticket is not waiting for diagnosis review",
          "TICKET_NOT_AWAITING_DIAGNOSIS_REVIEW",
        );
      }

      await this.repository.approve(connection, diagnosisId, actor.id);
      await this.repository.createNotification(connection, {
        userId: current.technician_id,
        type: "DIAGNOSIS_APPROVED",
        title: "Chẩn đoán đã được phê duyệt",
        content: `Bản chẩn đoán của phiếu sửa chữa ${ticket.ticket_code} đã được phê duyệt.`,
        ticketId: ticket.id,
      });
      await this.repository.createNotification(connection, {
        userId: ticket.customer_id,
        type: "DIAGNOSIS_APPROVED",
        title: "Chẩn đoán sửa chữa đã được phê duyệt",
        content: `Bản chẩn đoán của phiếu sửa chữa ${ticket.ticket_code} đã được phê duyệt và đang được chuẩn bị báo giá.`,
        ticketId: ticket.id,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "DIAGNOSIS_APPROVED",
        entityType: "DIAGNOSIS",
        entityId: diagnosisId,
        oldData: { status: current.status },
        newData: { status: "APPROVED", reason: reason ?? null },
        ...requestMetadata,
      });

      return this.requireHydratedDiagnosis(connection, diagnosisId);
    });
  }

  private assertTechnicianRole(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "TECHNICIAN") {
      throw new ForbiddenError(
        "Only assigned technicians may modify diagnoses",
        "FORBIDDEN",
      );
    }
  }

  private assertManagerRole(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "MANAGER") {
      throw new ForbiddenError("Only managers may review diagnoses", "FORBIDDEN");
    }
  }

  private assertDiagnosisAuthor(
    actor: Express.AuthenticatedUser,
    diagnosis: DiagnosisRow,
  ): void {
    if (diagnosis.technician_id !== actor.id) {
      throw new ForbiddenError(
        "Only the diagnosis author may modify it",
        "DIAGNOSIS_AUTHOR_REQUIRED",
      );
    }
  }

  private async assertReadScope(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
  ): Promise<void> {
    if (actor.role === "MANAGER") {
      return;
    }

    if (actor.role === "CUSTOMER" && actor.id === ticket.customer_id) {
      return;
    }

    if (
      actor.role === "TECHNICIAN" &&
      await this.tickets.hasActiveAssignment(executor, ticket.id, actor.id)
    ) {
      return;
    }

    throw new ForbiddenError("You are not allowed to view these diagnoses", "FORBIDDEN");
  }

  private async assertActiveAssignee(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<void> {
    if (!await this.tickets.hasActiveAssignment(executor, ticketId, actor.id)) {
      throw new ForbiddenError(
        "An active ticket assignment is required",
        "ACTIVE_ASSIGNMENT_REQUIRED",
      );
    }
  }

  private async validateParts(
    connection: PoolConnection,
    parts: DiagnosisPartDto[],
  ): Promise<void> {
    const partIds = parts.map((part) => part.partId);
    const activeParts = await this.repository.findActivePartsForUpdate(
      connection,
      partIds,
    );

    if (activeParts.length !== partIds.length) {
      throw new NotFoundError(
        "One or more active parts were not found",
        "PART_NOT_AVAILABLE",
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

  private async requireDiagnosis(
    executor: DatabaseExecutor,
    diagnosisId: number,
    lockForUpdate = false,
  ): Promise<DiagnosisRow> {
    const diagnosis = await this.repository.findById(
      executor,
      diagnosisId,
      lockForUpdate,
    );
    if (!diagnosis) {
      throw new NotFoundError("Diagnosis not found", "DIAGNOSIS_NOT_FOUND");
    }
    return diagnosis;
  }

  private async hydrate(
    executor: DatabaseExecutor,
    rows: DiagnosisRow[],
  ): Promise<Diagnosis[]> {
    const partRows = await this.repository.listPartsByDiagnosisIds(
      executor,
      rows.map((row) => row.id),
    );
    const partsByDiagnosis = new Map<number, DiagnosisPartRow[]>();
    for (const part of partRows) {
      const diagnosisParts = partsByDiagnosis.get(part.diagnosis_id) ?? [];
      diagnosisParts.push(part);
      partsByDiagnosis.set(part.diagnosis_id, diagnosisParts);
    }
    return rows.map((row) => toDiagnosis(row, partsByDiagnosis.get(row.id) ?? []));
  }

  private async requireHydratedDiagnosis(
    executor: DatabaseExecutor,
    diagnosisId: number,
  ): Promise<Diagnosis> {
    const row = await this.requireDiagnosis(executor, diagnosisId);
    const [diagnosis] = await this.hydrate(executor, [row]);
    if (!diagnosis) {
      throw new NotFoundError("Diagnosis not found", "DIAGNOSIS_NOT_FOUND");
    }
    return diagnosis;
  }

  private async transitionTicket(
    connection: PoolConnection,
    changedBy: number,
    ticket: RepairTicketRow,
    targetStatus: "DIAGNOSING" | "WAITING_FOR_QUOTATION",
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
}

export const diagnosisService = new DiagnosisService();
