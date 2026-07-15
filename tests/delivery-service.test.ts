import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { DeliveryRow } from "../src/modules/deliveries/delivery.model.js";
import type { DeliveryRepository } from "../src/modules/deliveries/delivery.repository.js";
import { DeliveryService } from "../src/modules/deliveries/delivery.service.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const receptionist = { id: 4, email: "front@example.com", role: "RECEPTIONIST" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };
const manager = { id: 5, email: "manager@example.com", role: "MANAGER" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };

function ticket(status: RepairTicketRow["status"]): RepairTicketRow {
  const now = new Date();
  return { id: 10, ticket_code: "RT-10", customer_id: 2, customer_name: "Customer", device_id: 3, device_model: null, device_serial_number: null, device_category: "Phone", device_brand: null, created_by: 4, creator_name: "Receptionist", title: "Broken", customer_issue: "No power", initial_condition: null, accessories_received: null, status, priority: "NORMAL", expected_diagnosis_at: null, expected_completion_at: null, received_at: now, completed_at: now, delivered_at: null, closed_at: null, cancellation_reason: null, created_at: now, updated_at: now } as RepairTicketRow;
}
function deliveryRow(): DeliveryRow { return { id: 8, ticket_id: 10, ticket_code: "RT-10", customer_id: 2, delivered_by: 4, delivered_by_name: "Receptionist", recipient_name: "Customer", recipient_phone: null, proof_url: null, note: null, delivered_at: new Date() } as DeliveryRow; }
function dependencies() {
  const repository = { findByTicket: vi.fn(), findInvoiceForUpdate: vi.fn(), create: vi.fn().mockResolvedValue(8), createProofAttachment: vi.fn(), createNotification: vi.fn(), createClosedNotification: vi.fn() };
  const tickets = { findById: vi.fn(), updateStatus: vi.fn(), createStatusHistory: vi.fn() };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) => callback(connection));
  const service = new DeliveryService(repository as unknown as DeliveryRepository, tickets as unknown as RepairTicketRepository, auditLogs as unknown as AuditLogRepository, transaction as unknown as <T>(callback: (value: PoolConnection) => Promise<T>) => Promise<T>);
  return { service, repository, tickets, auditLogs };
}

describe("DeliveryService", () => {
  it("delivers a fully paid ready ticket atomically", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("READY_FOR_DELIVERY"));
    deps.repository.findByTicket.mockResolvedValueOnce(null).mockResolvedValueOnce(deliveryRow());
    deps.repository.findInvoiceForUpdate.mockResolvedValue({ id: 20, total_amount: 100, paid_amount: 100, payment_status: "PAID" });
    await deps.service.deliver(receptionist, 10, { recipientName: "Customer" }, metadata);
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(connection, 10, "DELIVERED");
    expect(deps.repository.createNotification).toHaveBeenCalledWith(connection, 2, 10, "RT-10");
    expect(deps.auditLogs.create).toHaveBeenCalledWith(connection, expect.objectContaining({ action: "DEVICE_DELIVERED" }));
  });

  it("requires a manager reason for unpaid delivery", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("COMPLETED"));
    deps.repository.findByTicket.mockResolvedValue(null);
    deps.repository.findInvoiceForUpdate.mockResolvedValue({ id: 20, total_amount: 100, paid_amount: 0, payment_status: "UNPAID" });
    await expect(deps.service.deliver(manager, 10, { recipientName: "Customer" }, metadata)).rejects.toMatchObject({ code: "DELIVERY_PAYMENT_EXCEPTION_REQUIRED" });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("records both state transitions for an approved payment exception", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("COMPLETED"));
    deps.repository.findByTicket.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...deliveryRow(), delivered_by: 5, delivered_by_name: "Manager" });
    deps.repository.findInvoiceForUpdate.mockResolvedValue({ id: 20, total_amount: 100, paid_amount: 0, payment_status: "UNPAID" });
    await deps.service.deliver(manager, 10, { recipientName: "Customer", paymentExceptionReason: "Warranty exception" }, metadata);
    expect(deps.tickets.updateStatus).toHaveBeenNthCalledWith(1, connection, 10, "READY_FOR_DELIVERY");
    expect(deps.tickets.updateStatus).toHaveBeenNthCalledWith(2, connection, 10, "DELIVERED");
    expect(deps.auditLogs.create).toHaveBeenCalledWith(connection, expect.objectContaining({ action: "DEVICE_DELIVERED_WITH_PAYMENT_EXCEPTION" }));
  });

  it("rejects duplicate delivery records", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("READY_FOR_DELIVERY"));
    deps.repository.findByTicket.mockResolvedValue(deliveryRow());
    await expect(deps.service.deliver(receptionist, 10, { recipientName: "Customer" }, metadata)).rejects.toMatchObject({ code: "DELIVERY_ALREADY_EXISTS" });
  });

  it("closes only after a recorded delivery", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("DELIVERED"));
    deps.repository.findByTicket.mockResolvedValue(deliveryRow());
    await expect(deps.service.close(receptionist, 10, { reason: "Handover complete" }, metadata)).resolves.toEqual({ ticketId: 10, status: "CLOSED" });
    expect(deps.tickets.updateStatus).toHaveBeenCalledWith(connection, 10, "CLOSED");
    expect(deps.repository.createClosedNotification).toHaveBeenCalledWith(connection, 2, 10, "RT-10");
    expect(deps.auditLogs.create).toHaveBeenCalledWith(connection, expect.objectContaining({ action: "REPAIR_TICKET_CLOSED" }));
  });
});
