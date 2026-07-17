import type { Pool, PoolConnection } from "mysql2/promise";
import { ALLOWED_TICKET_TRANSITIONS, type TicketStatus } from "../../common/constants/ticket-status.js";
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
  CompleteTestingDto,
  CreateRepairLogDto,
  CreateTestResultDto,
  RepairLogPartDto,
  UpdateRepairLogDto,
} from "./repair-action.dto.js";
import {
  toCustomerRepairLog,
  toCustomerTestResult,
  toRepairLog,
  toTestResult,
  toTimelineEvent,
  type CustomerRepairLog,
  type CustomerTestResult,
  type RepairLog,
  type RepairLogPartRow,
  type RepairLogRow,
  type TestingCompletionResult,
  type TestResult,
  type TimelineEvent,
} from "./repair-action.model.js";
import {
  repairActionRepository,
  type RepairActionRepository,
} from "./repair-action.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;
type RepairLogView = RepairLog | CustomerRepairLog;
type TestResultView = TestResult | CustomerTestResult;

const REPAIR_LOG_WRITABLE_STATUSES = new Set<TicketStatus>([
  "WAITING_FOR_PARTS",
  "REPAIRING",
]);

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class RepairActionService {
  public constructor(
    private readonly repository: RepairActionRepository = repairActionRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async listRepairLogs(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<RepairLogView[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(pool, actor, ticket);
    const logs = await this.hydrateRepairLogs(
      pool,
      await this.repository.listRepairLogs(pool, ticketId),
    );
    return actor.role === "CUSTOMER" ? logs.map(toCustomerRepairLog) : logs;
  }

  public async createRepairLog(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateRepairLogDto,
    metadata: RequestMetadata,
  ): Promise<RepairLog> {
    this.assertTechnician(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      await this.assertActiveAssignee(connection, actor, ticketId);
      if (!REPAIR_LOG_WRITABLE_STATUSES.has(ticket.status)) {
        throw new ConflictError(
          "Repair logs may be created only while repairing or waiting for parts",
          "TICKET_NOT_REPAIRING",
        );
      }

      const startedAt = input.startedAt ?? new Date();
      if (input.finishedAt && input.finishedAt < startedAt) {
        throw new ConflictError(
          "Finished time must be after started time",
          "INVALID_REPAIR_LOG_TIME_RANGE",
        );
      }
      await this.assertPartUsageAvailable(connection, ticketId, input.parts);
      const repairLogId = await this.repository.createRepairLog(
        connection,
        ticketId,
        actor.id,
        input,
        startedAt,
      );
      await this.repository.replaceRepairLogParts(connection, repairLogId, input.parts);
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "REPAIR_LOG_CREATED",
        entityType: "REPAIR_LOG",
        entityId: repairLogId,
        oldData: null,
        newData: {
          ticketId,
          finished: Boolean(input.finishedAt),
          parts: input.parts,
        },
        ...requestMetadata,
      });
      return this.requireHydratedRepairLog(connection, repairLogId);
    });
  }

  public async updateRepairLog(
    actor: Express.AuthenticatedUser,
    repairLogId: number,
    input: UpdateRepairLogDto,
    metadata: RequestMetadata,
  ): Promise<RepairLog> {
    this.assertTechnician(actor);
    const reference = await this.requireRepairLog(pool, repairLogId);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const current = await this.requireRepairLog(connection, repairLogId, true);
      await this.assertActiveAssignee(connection, actor, ticket.id);
      if (current.technician_id !== actor.id) {
        throw new ForbiddenError(
          "Only the repair log author may update it",
          "REPAIR_LOG_AUTHOR_REQUIRED",
        );
      }
      if (!REPAIR_LOG_WRITABLE_STATUSES.has(ticket.status)) {
        throw new ConflictError(
          "Repair logs may be updated only while repairing or waiting for parts",
          "TICKET_NOT_REPAIRING",
        );
      }
      if (current.finished_at) {
        throw new ConflictError(
          "Completed repair logs are immutable",
          "REPAIR_LOG_IMMUTABLE",
        );
      }

      const effectiveStartedAt = input.startedAt === undefined
        ? current.started_at
        : input.startedAt;
      const effectiveFinishedAt = input.finishedAt === undefined
        ? current.finished_at
        : input.finishedAt;
      if (
        effectiveStartedAt &&
        effectiveFinishedAt &&
        effectiveFinishedAt < effectiveStartedAt
      ) {
        throw new ConflictError(
          "Finished time must be after started time",
          "INVALID_REPAIR_LOG_TIME_RANGE",
        );
      }
      if (input.parts) {
        await this.assertPartUsageAvailable(
          connection,
          ticket.id,
          input.parts,
          repairLogId,
        );
      }

      const { parts: _parts, ...fields } = input;
      await this.repository.updateRepairLog(connection, repairLogId, fields);
      if (input.parts) {
        await this.repository.replaceRepairLogParts(connection, repairLogId, input.parts);
      }
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: effectiveFinishedAt ? "REPAIR_LOG_COMPLETED" : "REPAIR_LOG_UPDATED",
        entityType: "REPAIR_LOG",
        entityId: repairLogId,
        oldData: {
          finishedAt: current.finished_at,
        },
        newData: {
          finishedAt: effectiveFinishedAt,
          parts: input.parts,
        },
        ...requestMetadata,
      });
      return this.requireHydratedRepairLog(connection, repairLogId);
    });
  }

  public async listTestResults(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<TestResultView[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(pool, actor, ticket);
    const results = (await this.repository.listTestResults(pool, ticketId)).map(toTestResult);
    return actor.role === "CUSTOMER" ? results.map(toCustomerTestResult) : results;
  }

  public async createTestResult(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateTestResultDto,
    metadata: RequestMetadata,
  ): Promise<TestResult> {
    this.assertTechnician(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      await this.assertActiveAssignee(connection, actor, ticketId);
      if (ticket.status !== "REPAIRING" && ticket.status !== "TESTING") {
        throw new ConflictError(
          "Ticket is not ready for testing",
          "TICKET_NOT_TESTABLE",
        );
      }
      if (!await this.repository.hasFinishedRepairLog(connection, ticketId)) {
        throw new ConflictError(
          "At least one completed repair log is required before testing",
          "COMPLETED_REPAIR_LOG_REQUIRED",
        );
      }
      if (await this.repository.hasUnfinishedRepairLog(connection, ticketId)) {
        throw new ConflictError(
          "Finish all repair logs before starting testing",
          "UNFINISHED_REPAIR_LOG_EXISTS",
        );
      }
      if (ticket.status === "REPAIRING") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "TESTING",
          `Testing started with ${input.testName}`,
        );
      }
      const testResultId = await this.repository.createTestResult(
        connection,
        ticketId,
        actor.id,
        input,
      );
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "TEST_RESULT_RECORDED",
        entityType: "TEST_RESULT",
        entityId: testResultId,
        oldData: null,
        newData: { ticketId, testName: input.testName, result: input.result },
        ...requestMetadata,
      });
      const result = await this.repository.findTestResultById(connection, testResultId);
      if (!result) {
        throw new NotFoundError("Test result not found", "TEST_RESULT_NOT_FOUND");
      }
      return toTestResult(result);
    });
  }

  public async completeTesting(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CompleteTestingDto,
    metadata: RequestMetadata,
  ): Promise<TestingCompletionResult> {
    this.assertTechnician(actor);
    const requestMetadata = normalizeMetadata(metadata);

    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      await this.assertActiveAssignee(connection, actor, ticketId);
      if (ticket.status !== "TESTING") {
        throw new ConflictError(
          "Ticket is not in the testing state",
          "TICKET_NOT_TESTING",
        );
      }
      if (await this.repository.hasUnfinishedRepairLog(connection, ticketId)) {
        throw new ConflictError(
          "Finish all repair logs before completing testing",
          "UNFINISHED_REPAIR_LOG_EXISTS",
        );
      }

      const results = await this.repository.listTestResults(connection, ticketId);
      const latestByName = new Map<string, (typeof results)[number]>();
      for (const result of results) {
        const normalizedName = result.test_name.trim().toLocaleLowerCase("en-US");
        if (!latestByName.has(normalizedName)) {
          latestByName.set(normalizedName, result);
        }
      }
      if (latestByName.size === 0) {
        throw new ConflictError(
          "At least one test result is required",
          "TEST_RESULT_REQUIRED",
        );
      }

      const allPassed = [...latestByName.values()].every(
        (result) => result.result === "PASS",
      );
      const targetStatus = allPassed ? "COMPLETED" : "REPAIRING";
      const reason = input.reason ?? (allPassed
        ? "All latest test results passed"
        : "One or more latest test results failed; additional repair required");
      await this.transitionTicket(connection, actor.id, ticket, targetStatus, reason);

      if (allPassed) {
        await this.repository.createNotification(connection, {
          userId: ticket.customer_id,
          type: "REPAIR_COMPLETED",
          title: "Sửa chữa đã hoàn tất",
          content: `Phiếu sửa chữa ${ticket.ticket_code} đã vượt qua kiểm tra kỹ thuật.`,
          ticketId,
        });
      }
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: allPassed ? "TESTING_COMPLETED" : "TESTING_FAILED",
        entityType: "REPAIR_TICKET",
        entityId: ticketId,
        oldData: { status: ticket.status },
        newData: {
          status: targetStatus,
          latestResults: [...latestByName.values()].map((result) => ({
            testName: result.test_name,
            result: result.result,
          })),
          reason,
        },
        ...requestMetadata,
      });
      return {
        outcome: allPassed ? "COMPLETED" : "REPAIR_REQUIRED",
        ticketStatus: targetStatus,
      };
    });
  }

  public async getTimeline(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<TimelineEvent[]> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(pool, actor, ticket, true);
    const customerSafe = actor.role === "CUSTOMER";
    return (await this.repository.listTimeline(ticketId)).map((row) =>
      toTimelineEvent(row, customerSafe));
  }

  private assertTechnician(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "TECHNICIAN") {
      throw new ForbiddenError(
        "Only assigned technicians may record repair actions",
        "FORBIDDEN",
      );
    }
  }

  private async assertReadScope(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
    allowReceptionist = false,
  ): Promise<void> {
    if (actor.role === "MANAGER" || (allowReceptionist && actor.role === "RECEPTIONIST")) {
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
    throw new ForbiddenError(
      "You are not allowed to view repair actions for this ticket",
      "REPAIR_ACTION_ACCESS_DENIED",
    );
  }

  private async assertActiveAssignee(
    executor: DatabaseExecutor,
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<void> {
    if (!await this.tickets.hasActiveAssignment(executor, ticketId, actor.id)) {
      throw new ForbiddenError(
        "An active technician assignment is required",
        "ACTIVE_ASSIGNMENT_REQUIRED",
      );
    }
  }

  private async assertPartUsageAvailable(
    executor: DatabaseExecutor,
    ticketId: number,
    parts: RepairLogPartDto[],
    excludingRepairLogId?: number,
  ): Promise<void> {
    if (parts.length === 0) {
      return;
    }
    const [fulfilledRows, usedRows] = await Promise.all([
      this.repository.listFulfilledPartTotals(executor, ticketId),
      this.repository.listUsedPartTotals(executor, ticketId, excludingRepairLogId),
    ]);
    const fulfilled = new Map(fulfilledRows.map((row) => [row.part_id, row.quantity]));
    const used = new Map(usedRows.map((row) => [row.part_id, row.quantity]));
    for (const part of parts) {
      const available = (fulfilled.get(part.partId) ?? 0) - (used.get(part.partId) ?? 0);
      if (part.quantity > available) {
        throw new ConflictError(
          `Part ${part.partId} usage exceeds the fulfilled quantity`,
          "UNFULFILLED_PART_USAGE",
          { partId: part.partId, available, requested: part.quantity },
        );
      }
    }
  }

  private async requireTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(executor, ticketId, lockForUpdate);
    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "REPAIR_TICKET_NOT_FOUND");
    }
    return ticket;
  }

  private async requireRepairLog(
    executor: DatabaseExecutor,
    repairLogId: number,
    lockForUpdate = false,
  ): Promise<RepairLogRow> {
    const repairLog = await this.repository.findRepairLogById(
      executor,
      repairLogId,
      lockForUpdate,
    );
    if (!repairLog) {
      throw new NotFoundError("Repair log not found", "REPAIR_LOG_NOT_FOUND");
    }
    return repairLog;
  }

  private async hydrateRepairLogs(
    executor: DatabaseExecutor,
    rows: RepairLogRow[],
  ): Promise<RepairLog[]> {
    const partRows = await this.repository.listRepairLogParts(
      executor,
      rows.map((row) => row.id),
    );
    const partsByLog = new Map<number, RepairLogPartRow[]>();
    for (const part of partRows) {
      const items = partsByLog.get(part.repair_log_id) ?? [];
      items.push(part);
      partsByLog.set(part.repair_log_id, items);
    }
    return rows.map((row) => toRepairLog(row, partsByLog.get(row.id) ?? []));
  }

  private async requireHydratedRepairLog(
    executor: DatabaseExecutor,
    repairLogId: number,
  ): Promise<RepairLog> {
    const row = await this.requireRepairLog(executor, repairLogId);
    const [log] = await this.hydrateRepairLogs(executor, [row]);
    if (!log) {
      throw new NotFoundError("Repair log not found", "REPAIR_LOG_NOT_FOUND");
    }
    return log;
  }

  private async transitionTicket(
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

export const repairActionService = new RepairActionService();
