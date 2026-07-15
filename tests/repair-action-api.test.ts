import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { repairActionService } from "../src/modules/repair-actions/repair-action.service.js";

const sessionId = "841922bd-d85c-40e7-952e-a8615676375a";
const repairLog = {
  id: 20,
  ticketId: 10,
  technician: { id: 6, fullName: "Technician" },
  actionDescription: "Replace display assembly",
  result: null,
  startedAt: new Date(),
  finishedAt: null,
  parts: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => vi.restoreAllMocks());

function authenticate(role: "CUSTOMER" | "TECHNICIAN" | "MANAGER") {
  vi.spyOn(authService, "authenticate").mockResolvedValue({
    id: role === "CUSTOMER" ? 2 : role === "TECHNICIAN" ? 6 : 5,
    email: `${role.toLowerCase()}@example.com`,
    role,
    sessionId,
  });
}

describe("repair actions API", () => {
  it("creates a validated repair log for a technician", async () => {
    authenticate("TECHNICIAN");
    const create = vi.spyOn(repairActionService, "createRepairLog")
      .mockResolvedValue(repairLog);
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/repair-logs`)
      .set("Authorization", "Bearer token")
      .send({
        actionDescription: "Replace display assembly",
        parts: [{ partId: 4, quantity: 1 }],
      });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "TECHNICIAN" }),
      10,
      expect.objectContaining({ parts: [{ partId: 4, quantity: 1 }] }),
      expect.anything(),
    );
  });

  it("rejects duplicate repair-log parts before service execution", async () => {
    authenticate("TECHNICIAN");
    const create = vi.spyOn(repairActionService, "createRepairLog");
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/repair-logs`)
      .set("Authorization", "Bearer token")
      .send({
        actionDescription: "Replace display assembly",
        parts: [
          { partId: 4, quantity: 1 },
          { partId: 4, quantity: 1 },
        ],
      });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps managers read-only for repair logs", async () => {
    authenticate("MANAGER");
    const create = vi.spyOn(repairActionService, "createRepairLog");
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/repair-logs`)
      .set("Authorization", "Bearer token")
      .send({ actionDescription: "Not allowed" });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("records a PASS or FAIL test result", async () => {
    authenticate("TECHNICIAN");
    const create = vi.spyOn(repairActionService, "createTestResult")
      .mockResolvedValue({
        id: 30,
        ticketId: 10,
        testedBy: { id: 6, fullName: "Technician" },
        testName: "Display",
        result: "PASS",
        note: null,
        testedAt: new Date(),
      });
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/test-results`)
      .set("Authorization", "Bearer token")
      .send({ testName: "Display", result: "PASS" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 6 }),
      10,
      expect.objectContaining({ testName: "Display", result: "PASS" }),
      expect.anything(),
    );
  });

  it("completes testing through the ticket-scoped action", async () => {
    authenticate("TECHNICIAN");
    const complete = vi.spyOn(repairActionService, "completeTesting")
      .mockResolvedValue({ outcome: "COMPLETED", ticketStatus: "COMPLETED" });
    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/complete-testing`)
      .set("Authorization", "Bearer token")
      .send({ reason: "All checks passed" });

    expect(response.status).toBe(200);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 6 }),
      10,
      { reason: "All checks passed" },
      expect.anything(),
    );
  });

  it("exposes the scoped aggregated timeline", async () => {
    authenticate("CUSTOMER");
    const timeline = vi.spyOn(repairActionService, "getTimeline")
      .mockResolvedValue([]);
    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/10/timeline`)
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(timeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      10,
    );
  });
});
