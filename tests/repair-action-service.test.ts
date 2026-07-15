import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type {
  RepairLogRow,
  TestResultRow,
  TimelineEventRow,
} from "../src/modules/repair-actions/repair-action.model.js";
import type { RepairActionRepository } from "../src/modules/repair-actions/repair-action.repository.js";
import { RepairActionService } from "../src/modules/repair-actions/repair-action.service.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const technician = {
  id: 6,
  email: "technician@example.com",
  role: "TECHNICIAN" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "841922bd-d85c-40e7-952e-a8615676375a",
};

function ticket(overrides: Record<string, unknown> = {}): RepairTicketRow {
  const now = new Date();
  return {
    id: 10,
    ticket_code: "RT-2026-000010",
    customer_id: 2,
    customer_name: "Customer",
    device_id: 3,
    device_model: "Model X",
    device_serial_number: null,
    device_category: "Phone",
    device_brand: null,
    created_by: 4,
    creator_name: "Receptionist",
    title: "Screen failure",
    customer_issue: "No display",
    initial_condition: null,
    accessories_received: null,
    status: "REPAIRING",
    priority: "NORMAL",
    expected_diagnosis_at: null,
    expected_completion_at: null,
    received_at: now,
    completed_at: null,
    delivered_at: null,
    closed_at: null,
    cancellation_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as RepairTicketRow;
}

function repairLog(overrides: Record<string, unknown> = {}): RepairLogRow {
  const now = new Date();
  return {
    id: 20,
    ticket_id: 10,
    technician_id: 6,
    technician_name: "Technician",
    action_description: "Replace display assembly",
    result: null,
    started_at: now,
    finished_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as RepairLogRow;
}

function testResult(
  id: number,
  name: string,
  result: "PASS" | "FAIL",
  testedAt = new Date(),
): TestResultRow {
  return {
    id,
    ticket_id: 10,
    tested_by: 6,
    tested_by_name: "Technician",
    test_name: name,
    result,
    note: null,
    tested_at: testedAt,
  } as TestResultRow;
}

function dependencies() {
  const repository = {
    listRepairLogs: vi.fn(),
    findRepairLogById: vi.fn(),
    listRepairLogParts: vi.fn().mockResolvedValue([]),
    createRepairLog: vi.fn().mockResolvedValue(20),
    updateRepairLog: vi.fn(),
    replaceRepairLogParts: vi.fn(),
    listFulfilledPartTotals: vi.fn().mockResolvedValue([]),
    listUsedPartTotals: vi.fn().mockResolvedValue([]),
    hasFinishedRepairLog: vi.fn().mockResolvedValue(true),
    listTestResults: vi.fn().mockResolvedValue([]),
    createTestResult: vi.fn().mockResolvedValue(30),
    findTestResultById: vi.fn(),
    createNotification: vi.fn(),
    listTimeline: vi.fn().mockResolvedValue([]),
  };
  const tickets = {
    findById: vi.fn(),
    hasActiveAssignment: vi.fn().mockResolvedValue(true),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection));
  const service = new RepairActionService(
    repository as unknown as RepairActionRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );
  return { service, repository, tickets, auditLogs };
}

describe("RepairActionService", () => {
  it("creates an assigned-technician repair log using fulfilled parts", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listFulfilledPartTotals.mockResolvedValue([{ part_id: 4, quantity: 2 }]);
    deps.repository.findRepairLogById.mockResolvedValue(repairLog());

    const result = await deps.service.createRepairLog(technician, 10, {
      actionDescription: "Replace display assembly",
      parts: [{ partId: 4, quantity: 1 }],
    }, metadata);

    expect(result.id).toBe(20);
    expect(deps.repository.replaceRepairLogParts).toHaveBeenCalledWith(
      connection,
      20,
      [{ partId: 4, quantity: 1 }],
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "REPAIR_LOG_CREATED" }),
    );
  });

  it("rejects cumulative part usage above fulfilled quantities", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listFulfilledPartTotals.mockResolvedValue([{ part_id: 4, quantity: 2 }]);
    deps.repository.listUsedPartTotals.mockResolvedValue([{ part_id: 4, quantity: 1 }]);

    await expect(deps.service.createRepairLog(technician, 10, {
      actionDescription: "Use another display",
      parts: [{ partId: 4, quantity: 2 }],
    }, metadata)).rejects.toMatchObject({ code: "UNFULFILLED_PART_USAGE" });
    expect(deps.repository.createRepairLog).not.toHaveBeenCalled();
  });

  it("keeps finished repair logs immutable", async () => {
    const deps = dependencies();
    deps.repository.findRepairLogById.mockResolvedValue(
      repairLog({ finished_at: new Date() }),
    );
    deps.tickets.findById.mockResolvedValue(ticket());

    await expect(deps.service.updateRepairLog(technician, 20, {
      result: "Done",
    }, metadata)).rejects.toMatchObject({ code: "REPAIR_LOG_IMMUTABLE" });
    expect(deps.repository.updateRepairLog).not.toHaveBeenCalled();
  });

  it("returns a sanitized repair-log view to the owning customer", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listRepairLogs.mockResolvedValue([
      repairLog({ result: "Internal diagnostic detail" }),
    ]);

    const [view] = await deps.service.listRepairLogs(customer, 10);

    expect(view).toMatchObject({ id: 20, actionDescription: "Replace display assembly" });
    expect(view).not.toHaveProperty("result");
    expect(view).not.toHaveProperty("technician");
    expect(view).not.toHaveProperty("parts");
  });

  it("records the first test and atomically starts testing", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findTestResultById.mockResolvedValue(
      testResult(30, "Display", "PASS"),
    );

    const result = await deps.service.createTestResult(technician, 10, {
      testName: "Display",
      result: "PASS",
    }, metadata);

    expect(result.result).toBe("PASS");
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(connection, 10, "TESTING");
    expect(deps.tickets.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ fromStatus: "REPAIRING", toStatus: "TESTING" }),
    );
  });

  it("completes testing when every latest named result passes", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "TESTING" }));
    deps.repository.listTestResults.mockResolvedValue([
      testResult(3, "Display", "PASS", new Date("2026-07-15T03:00:00Z")),
      testResult(2, "Charging", "PASS", new Date("2026-07-15T02:00:00Z")),
      testResult(1, "Display", "FAIL", new Date("2026-07-15T01:00:00Z")),
    ]);

    const result = await deps.service.completeTesting(technician, 10, {}, metadata);

    expect(result).toEqual({ outcome: "COMPLETED", ticketStatus: "COMPLETED" });
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(connection, 10, "COMPLETED");
    expect(deps.repository.createNotification).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ userId: 2, type: "REPAIR_COMPLETED" }),
    );
  });

  it("returns failed testing to repair and keeps the failure history", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "TESTING" }));
    deps.repository.listTestResults.mockResolvedValue([
      testResult(2, "Charging", "FAIL"),
      testResult(1, "Display", "PASS"),
    ]);

    const result = await deps.service.completeTesting(technician, 10, {}, metadata);

    expect(result).toEqual({ outcome: "REPAIR_REQUIRED", ticketStatus: "REPAIRING" });
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(connection, 10, "REPAIRING");
    expect(deps.repository.createNotification).not.toHaveBeenCalled();
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "TESTING_FAILED" }),
    );
  });

  it("sanitizes internal timeline details for the owning customer", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listTimeline.mockResolvedValue([{
      event_key: "REPAIR_LOG:20",
      event_type: "REPAIR_LOG",
      title: "Repair work completed",
      description: "Internal procedure",
      actor_id: 6,
      actor_name: "Technician",
      actor_role: "TECHNICIAN",
      occurred_at: new Date(),
    } as TimelineEventRow]);

    const [event] = await deps.service.getTimeline(customer, 10);

    expect(event?.description).toBeNull();
    expect(event?.actor).toBeNull();
  });
});
