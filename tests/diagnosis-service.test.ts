import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { DiagnosisRow } from "../src/modules/diagnoses/diagnosis.model.js";
import type { DiagnosisRepository } from "../src/modules/diagnoses/diagnosis.repository.js";
import { DiagnosisService } from "../src/modules/diagnoses/diagnosis.service.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const technician = {
  id: 6,
  email: "technician@example.com",
  role: "TECHNICIAN" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const manager = {
  id: 5,
  email: "manager@example.com",
  role: "MANAGER" as const,
  sessionId: "47cb6cce-9789-4225-ac66-ab856ef49f93",
};
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "2c7063b2-cd1e-4f65-a4a1-28c1ab59b1c6",
};
const otherCustomer = {
  ...customer,
  id: 3,
  email: "other-customer@example.com",
};
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };

function ticket(overrides: Record<string, unknown> = {}): RepairTicketRow {
  const now = new Date();
  return {
    id: 10,
    ticket_code: "RT-2026-000010",
    customer_id: 2,
    customer_name: "Customer User",
    device_id: 7,
    device_model: "Model X",
    device_serial_number: null,
    device_category: "Smartphone",
    device_brand: null,
    created_by: 2,
    creator_name: "Customer User",
    title: "Screen is broken",
    customer_issue: "The screen does not display anything",
    initial_condition: null,
    accessories_received: null,
    status: "DIAGNOSING",
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

function diagnosis(overrides: Record<string, unknown> = {}): DiagnosisRow {
  const now = new Date();
  return {
    id: 20,
    ticket_id: 10,
    technician_id: 6,
    technician_name: "Technician One",
    actual_issue: "Display assembly failure",
    root_cause: "Impact damage",
    proposed_solution: "Replace the display assembly",
    labor_cost: 250_000,
    estimated_hours: 2,
    data_loss_risk: false,
    risk_note: "Internal handling note",
    status: "DRAFT",
    submitted_at: null,
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as DiagnosisRow;
}

function dependencies() {
  const repository = {
    listByTicket: vi.fn(),
    findById: vi.fn(),
    findOpenByTicketForUpdate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markDraft: vi.fn(),
    markSubmitted: vi.fn(),
    markRevisionRequired: vi.fn(),
    approve: vi.fn(),
    findActivePartsForUpdate: vi.fn(),
    replaceParts: vi.fn(),
    listPartsByDiagnosisIds: vi.fn(),
    findActiveManagerIds: vi.fn(),
    createNotification: vi.fn(),
  };
  const tickets = {
    findById: vi.fn(),
    hasActiveAssignment: vi.fn(),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new DiagnosisService(
    repository as unknown as DiagnosisRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );
  return { service, repository, tickets, auditLogs, transaction };
}

describe("DiagnosisService", () => {
  it("starts diagnosis only for the active assignee and transitions ASSIGNED", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "ASSIGNED" }));
    deps.tickets.hasActiveAssignment.mockResolvedValue(true);
    deps.repository.findOpenByTicketForUpdate.mockResolvedValue(null);
    deps.repository.findActivePartsForUpdate.mockResolvedValue([{ id: 4 }]);
    deps.repository.create.mockResolvedValue(20);
    deps.repository.findById.mockResolvedValue(diagnosis());
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);

    const result = await deps.service.create(
      technician,
      10,
      {
        actualIssue: "Display assembly failure",
        proposedSolution: "Replace the display assembly",
        laborCost: 250_000,
        dataLossRisk: false,
        parts: [{ partId: 4, quantity: 1 }],
      },
      metadata,
    );

    expect(result).toMatchObject({ id: 20, status: "DRAFT" });
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "DIAGNOSING",
    );
    expect(deps.tickets.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ fromStatus: "ASSIGNED", toStatus: "DIAGNOSING" }),
    );
    expect(deps.repository.replaceParts).toHaveBeenCalledWith(
      connection,
      20,
      [{ partId: 4, quantity: 1 }],
    );
  });

  it("rejects diagnosis writes without an active assignment", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "ASSIGNED" }));
    deps.tickets.hasActiveAssignment.mockResolvedValue(false);

    await expect(
      deps.service.create(
        technician,
        10,
        {
          actualIssue: "Display assembly failure",
          proposedSolution: "Replace the display assembly",
          laborCost: 0,
          dataLossRisk: false,
          parts: [],
        },
        metadata,
      ),
    ).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENT_REQUIRED" });
  });

  it("enforces owner and active-assignment scopes on diagnosis reads", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());

    await expect(deps.service.list(otherCustomer, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    deps.tickets.hasActiveAssignment.mockResolvedValue(false);
    await expect(deps.service.list(technician, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    deps.tickets.hasActiveAssignment.mockResolvedValue(true);
    deps.repository.listByTicket.mockResolvedValue([]);
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);
    await expect(deps.service.list(technician, 10)).resolves.toEqual([]);
  });

  it("returns a revised diagnosis to draft only for its active author", async () => {
    const deps = dependencies();
    const revision = diagnosis({ status: "REVISION_REQUIRED" });
    deps.repository.findById
      .mockResolvedValueOnce(revision)
      .mockResolvedValueOnce(revision)
      .mockResolvedValueOnce(diagnosis({ status: "DRAFT", actual_issue: "Clarified" }));
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.tickets.hasActiveAssignment.mockResolvedValue(true);
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);

    const result = await deps.service.update(
      technician,
      20,
      { actualIssue: "Clarified" },
      metadata,
    );

    expect(result.status).toBe("DRAFT");
    expect(deps.repository.markDraft).toHaveBeenCalledWith(connection, 20);

    const wrongAuthor = dependencies();
    wrongAuthor.repository.findById
      .mockResolvedValueOnce(revision)
      .mockResolvedValueOnce(revision);
    wrongAuthor.tickets.findById.mockResolvedValue(ticket());
    await expect(
      wrongAuthor.service.update(
        { ...technician, id: 8, email: "technician2@example.com" },
        20,
        { actualIssue: "Unauthorized edit" },
        metadata,
      ),
    ).rejects.toMatchObject({ code: "DIAGNOSIS_AUTHOR_REQUIRED" });
  });

  it("submits a draft and moves the ticket to quotation review atomically", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(diagnosis())
      .mockResolvedValueOnce(diagnosis())
      .mockResolvedValueOnce(
        diagnosis({ status: "SUBMITTED", submitted_at: new Date() }),
      );
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.tickets.hasActiveAssignment.mockResolvedValue(true);
    deps.repository.findActiveManagerIds.mockResolvedValue([5, 9]);
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);

    const result = await deps.service.submit(
      technician,
      20,
      "Diagnosis completed",
      metadata,
    );

    expect(result.status).toBe("SUBMITTED");
    expect(deps.repository.markSubmitted).toHaveBeenCalledWith(connection, 20);
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "WAITING_FOR_QUOTATION",
    );
    expect(deps.repository.createNotification).toHaveBeenCalledTimes(2);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "DIAGNOSIS_SUBMITTED" }),
    );
  });

  it("returns a submitted diagnosis for revision and resumes diagnosing", async () => {
    const deps = dependencies();
    const submitted = diagnosis({ status: "SUBMITTED", submitted_at: new Date() });
    deps.repository.findById
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(diagnosis({ status: "REVISION_REQUIRED" }));
    deps.tickets.findById.mockResolvedValue(
      ticket({ status: "WAITING_FOR_QUOTATION" }),
    );
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);

    const result = await deps.service.requestRevision(
      manager,
      20,
      "Clarify the root cause",
      metadata,
    );

    expect(result.status).toBe("REVISION_REQUIRED");
    expect(deps.repository.markRevisionRequired).toHaveBeenCalledWith(
      connection,
      20,
    );
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "DIAGNOSING",
    );
    expect(deps.repository.createNotification).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ userId: 6, type: "DIAGNOSIS_REVISION_REQUIRED" }),
    );
  });

  it("approves a submitted diagnosis without bypassing quotation status", async () => {
    const deps = dependencies();
    const submitted = diagnosis({ status: "SUBMITTED", submitted_at: new Date() });
    const approvedAt = new Date();
    deps.repository.findById
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(
        diagnosis({
          status: "APPROVED",
          submitted_at: new Date(),
          approved_by: 5,
          approved_by_name: "Manager User",
          approved_at: approvedAt,
        }),
      );
    deps.tickets.findById.mockResolvedValue(
      ticket({ status: "WAITING_FOR_QUOTATION" }),
    );
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([]);

    const result = await deps.service.approve(manager, 20, undefined, metadata);

    expect(result.status).toBe("APPROVED");
    expect(deps.repository.approve).toHaveBeenCalledWith(connection, 20, 5);
    expect(deps.tickets.updateStatus).not.toHaveBeenCalled();
    expect(deps.repository.createNotification).toHaveBeenCalledTimes(2);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "DIAGNOSIS_APPROVED" }),
    );
  });

  it("exposes only approved customer-safe diagnosis fields to the owner", async () => {
    const deps = dependencies();
    const approved = diagnosis({
      status: "APPROVED",
      submitted_at: new Date(),
      approved_by: 5,
      approved_by_name: "Manager User",
      approved_at: new Date(),
    });
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.listByTicket.mockResolvedValue([approved]);
    deps.repository.listPartsByDiagnosisIds.mockResolvedValue([
      {
        id: 40,
        diagnosis_id: 20,
        part_id: 4,
        sku: "DISPLAY-1",
        part_name: "Display assembly",
        quantity: 1,
        note: "Internal sourcing note",
        created_at: new Date(),
      },
    ]);

    const [result] = await deps.service.list(customer, 10);

    expect(deps.repository.listByTicket).toHaveBeenCalledWith(
      expect.anything(),
      10,
      true,
    );
    expect(result).toMatchObject({ id: 20, status: "APPROVED" });
    expect(result).not.toHaveProperty("rootCause");
    expect(result).not.toHaveProperty("riskNote");
    expect(result).not.toHaveProperty("technician");
    expect(result?.parts[0]).not.toHaveProperty("note");
  });
});
