import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";
import type { TicketAssignmentRepository } from "../src/modules/ticket-assignments/ticket-assignment.repository.js";
import { TicketAssignmentService } from "../src/modules/ticket-assignments/ticket-assignment.service.js";

const connection = {} as PoolConnection;
const manager = {
  id: 5,
  email: "manager@example.com",
  role: "MANAGER" as const,
  sessionId: "47cb6cce-9789-4225-ac66-ab856ef49f93",
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
    status: "RECEIVED",
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

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 30,
    ticket_id: 10,
    technician_id: 6,
    technician_name: "Technician One",
    technician_email: "technician@example.com",
    assigned_by: 5,
    assigned_by_name: "Manager User",
    assigned_at: new Date(),
    unassigned_at: null,
    is_active: true,
    note: null,
    ...overrides,
  };
}

function dependencies() {
  const repository = {
    listAssignableTechnicians: vi.fn(),
    findTechnicianForUpdate: vi.fn(),
    findActiveByTicketForUpdate: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    deactivate: vi.fn(),
    createNotification: vi.fn(),
  };
  const tickets = {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
  };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new TicketAssignmentService(
    repository as unknown as TicketAssignmentRepository,
    tickets as unknown as RepairTicketRepository,
    auditLogs as unknown as AuditLogRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );
  return { service, repository, tickets, auditLogs, transaction };
}

describe("TicketAssignmentService", () => {
  it("maps only repository-approved technician choices", async () => {
    const deps = dependencies();
    deps.repository.listAssignableTechnicians.mockResolvedValue([{
      id: 6, full_name: "Technician One", email: "technician@example.com",
      role: "TECHNICIAN", status: "ACTIVE", locked_until: null,
    }]);
    await expect(deps.service.listAssignableTechnicians(manager, {})).resolves.toEqual([
      { id: 6, fullName: "Technician One", email: "technician@example.com" },
    ]);
  });

  it("assigns an active technician and transitions the ticket atomically", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findActiveByTicketForUpdate.mockResolvedValue(null);
    deps.repository.findTechnicianForUpdate.mockResolvedValue({
      id: 6,
      full_name: "Technician One",
      email: "technician@example.com",
      role: "TECHNICIAN",
      status: "ACTIVE",
      locked_until: null,
    });
    deps.repository.create.mockResolvedValue(30);
    deps.repository.findById.mockResolvedValue(assignment());

    const result = await deps.service.assign(
      manager,
      10,
      { technicianId: 6 },
      metadata,
    );

    expect(result).toMatchObject({ id: 30, isActive: true });
    expect(deps.transaction).toHaveBeenCalledOnce();
    expect(deps.tickets.findById).toHaveBeenCalledWith(connection, 10, true);
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "ASSIGNED",
    );
    expect(deps.tickets.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ fromStatus: "RECEIVED", toStatus: "ASSIGNED" }),
    );
    expect(deps.repository.createNotification).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ userId: 6, type: "TICKET_ASSIGNED" }),
    );
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "TICKET_ASSIGNED" }),
    );
  });

  it("rejects assignment when the ticket already has an active technician", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findActiveByTicketForUpdate.mockResolvedValue(assignment());

    await expect(
      deps.service.assign(manager, 10, { technicianId: 6 }, metadata),
    ).rejects.toMatchObject({ code: "ACTIVE_ASSIGNMENT_EXISTS" });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("rejects inactive or temporarily locked technicians", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket());
    deps.repository.findActiveByTicketForUpdate.mockResolvedValue(null);
    deps.repository.findTechnicianForUpdate.mockResolvedValue({
      id: 6,
      full_name: "Technician One",
      email: "technician@example.com",
      role: "TECHNICIAN",
      status: "ACTIVE",
      locked_until: new Date(Date.now() + 60_000),
    });

    await expect(
      deps.service.assign(manager, 10, { technicianId: 6 }, metadata),
    ).rejects.toMatchObject({ code: "TECHNICIAN_NOT_AVAILABLE" });
  });

  it("closes the old assignment before creating a reassignment", async () => {
    const deps = dependencies();
    const current = assignment();
    deps.tickets.findById.mockResolvedValue(ticket({ status: "ASSIGNED" }));
    deps.repository.findActiveByTicketForUpdate.mockResolvedValue(current);
    deps.repository.findTechnicianForUpdate.mockResolvedValue({
      id: 8,
      full_name: "Technician Two",
      email: "technician2@example.com",
      role: "TECHNICIAN",
      status: "ACTIVE",
      locked_until: null,
    });
    deps.repository.create.mockResolvedValue(31);
    deps.repository.findById.mockResolvedValue(
      assignment({
        id: 31,
        technician_id: 8,
        technician_name: "Technician Two",
        technician_email: "technician2@example.com",
        note: "Workload balancing",
      }),
    );

    const result = await deps.service.reassign(
      manager,
      10,
      { technicianId: 8, note: "Workload balancing" },
      metadata,
    );

    expect(result.technician.id).toBe(8);
    expect(deps.repository.deactivate).toHaveBeenCalledWith(connection, 30);
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ technicianId: 8 }),
    );
    expect(deps.repository.createNotification).toHaveBeenCalledTimes(2);
    expect(deps.tickets.updateStatus).not.toHaveBeenCalled();
    expect(deps.auditLogs.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ action: "TICKET_REASSIGNED" }),
    );

    const blocked = dependencies();
    blocked.tickets.findById.mockResolvedValue(ticket({ status: "DIAGNOSING" }));
    await expect(
      blocked.service.reassign(
        manager,
        10,
        { technicianId: 8, note: "Late handoff" },
        metadata,
      ),
    ).rejects.toMatchObject({ code: "TICKET_NOT_REASSIGNABLE" });
  });
});
