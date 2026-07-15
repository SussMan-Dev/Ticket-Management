import { describe, expect, it, vi } from "vitest";
import type { ReportRepository } from "../src/modules/reports/report.repository.js";
import { ReportService } from "../src/modules/reports/report.service.js";

const manager = { id: 5, email: "manager@example.com", role: "MANAGER" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };
const inventory = { ...manager, role: "INVENTORY_STAFF" as const };
function service() { const repository = { ticketsByStatus: vi.fn().mockResolvedValue([]), partsUsage: vi.fn().mockResolvedValue([]), lowStock: vi.fn().mockResolvedValue([]) }; return { repository, service: new ReportService(repository as unknown as ReportRepository, () => new Date("2026-07-15T00:00:00Z")) }; }

describe("ReportService", () => {
  it("applies a default bounded 30-day range", async () => {
    const deps = service();
    await deps.service.ticketsByStatus(manager, {});
    expect(deps.repository.ticketsByStatus).toHaveBeenCalledWith(new Date("2026-06-15T00:00:00Z"), new Date("2026-07-15T00:00:00Z"));
  });

  it("rejects reversed and oversized date ranges", async () => {
    const deps = service();
    await expect(deps.service.ticketsByStatus(manager, { from: new Date("2026-07-15"), to: new Date("2026-07-01") })).rejects.toMatchObject({ code: "INVALID_REPORT_RANGE" });
    await expect(deps.service.ticketsByStatus(manager, { from: new Date("2024-01-01"), to: new Date("2026-01-01") })).rejects.toMatchObject({ code: "REPORT_RANGE_TOO_LARGE" });
  });

  it("allows inventory reports without exposing manager finance reports", async () => {
    const deps = service();
    await expect(deps.service.lowStock(inventory)).resolves.toEqual([]);
    await expect(deps.service.ticketsByStatus(inventory, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
