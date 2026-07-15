import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "../src/common/repositories/audit-log.repository.js";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";
import type { ReviewRow } from "../src/modules/reviews/review.model.js";
import type { ReviewRepository } from "../src/modules/reviews/review.repository.js";
import { ReviewService } from "../src/modules/reviews/review.service.js";

const connection = {} as PoolConnection;
const metadata = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const customer = { id: 2, email: "customer@example.com", role: "CUSTOMER" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };
function ticket(status: RepairTicketRow["status"], customerId = 2) { return { id: 10, ticket_code: "RT-10", customer_id: customerId, status } as RepairTicketRow; }
function row(createdAt = new Date("2026-07-14T00:00:00Z")): ReviewRow { return { id: 9, ticket_id: 10, ticket_code: "RT-10", ticket_status: "DELIVERED", customer_id: 2, customer_name: "Customer", rating: 5, technician_rating: 4, service_rating: 5, comment: "Good", created_at: createdAt, updated_at: createdAt } as ReviewRow; }
function dependencies() {
  const repository = { findByTicket: vi.fn(), findById: vi.fn(), create: vi.fn().mockResolvedValue(9), update: vi.fn() };
  const tickets = { findById: vi.fn(), hasActiveAssignment: vi.fn() };
  const auditLogs = { create: vi.fn() };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) => callback(connection));
  const service = new ReviewService(repository as unknown as ReviewRepository, tickets as unknown as RepairTicketRepository, auditLogs as unknown as AuditLogRepository, transaction as unknown as <T>(callback: (value: PoolConnection) => Promise<T>) => Promise<T>, () => new Date("2026-07-15T00:00:00Z"));
  return { service, repository, tickets, auditLogs };
}

describe("ReviewService", () => {
  it("creates one review for the delivered ticket owner", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("DELIVERED"));
    deps.repository.findByTicket.mockResolvedValue(null);
    deps.repository.findById.mockResolvedValue(row());
    const result = await deps.service.create(customer, 10, { rating: 5, comment: "Good" }, metadata);
    expect(result.rating).toBe(5);
    expect(deps.auditLogs.create).toHaveBeenCalledWith(connection, expect.objectContaining({ action: "REVIEW_CREATED" }));
  });

  it("enforces ticket ownership", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("DELIVERED", 99));
    await expect(deps.service.create(customer, 10, { rating: 5 }, metadata)).rejects.toMatchObject({ code: "TICKET_OWNER_REQUIRED" });
  });

  it("rejects review before delivery", async () => {
    const deps = dependencies();
    deps.tickets.findById.mockResolvedValue(ticket("COMPLETED"));
    await expect(deps.service.create(customer, 10, { rating: 5 }, metadata)).rejects.toMatchObject({ code: "TICKET_NOT_REVIEWABLE" });
  });

  it("keeps reviews editable for only seven days", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row(new Date("2026-07-01T00:00:00Z")));
    await expect(deps.service.update(customer, 9, { rating: 4 }, metadata)).rejects.toMatchObject({ code: "REVIEW_EDIT_WINDOW_EXPIRED" });
    expect(deps.repository.update).not.toHaveBeenCalled();
  });
});
