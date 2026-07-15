import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { reportService } from "../src/modules/reports/report.service.js";

afterEach(() => vi.restoreAllMocks());
function authenticate(role: "MANAGER" | "INVENTORY_STAFF") { vi.spyOn(authService, "authenticate").mockResolvedValue({ id: 5, email: `${role}@example.com`, role, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" }); }

describe("reports API", () => {
  it("returns manager dashboard metrics", async () => {
    authenticate("MANAGER");
    const dashboard = vi.spyOn(reportService, "dashboard").mockResolvedValue({ openTickets: 4, readyForDelivery: 1, deliveredThisMonth: 2, outstandingAmount: 100, netRevenueThisMonth: 900, lowStockParts: 1, averageRating: 4.5 });
    const response = await request(app).get(`${env.API_PREFIX}/reports/dashboard`).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.body.data.openTickets).toBe(4);
    expect(dashboard).toHaveBeenCalledWith(expect.objectContaining({ role: "MANAGER" }));
  });

  it("lets inventory staff access stock reports", async () => {
    authenticate("INVENTORY_STAFF");
    const lowStock = vi.spyOn(reportService, "lowStock").mockResolvedValue([]);
    const response = await request(app).get(`${env.API_PREFIX}/reports/low-stock`).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(lowStock).toHaveBeenCalled();
  });

  it("keeps finance reports manager-only", async () => {
    authenticate("INVENTORY_STAFF");
    const response = await request(app).get(`${env.API_PREFIX}/reports/revenue`).set("Authorization", "Bearer token");
    expect(response.status).toBe(403);
  });
});
