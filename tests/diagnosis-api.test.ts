import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { diagnosisService } from "../src/modules/diagnoses/diagnosis.service.js";

const sessionId = "775258a7-12e0-49c4-916d-3f58d6574a19";
const diagnosis = {
  id: 20,
  ticketId: 10,
  technician: { id: 6, fullName: "Technician One" },
  actualIssue: "Display assembly failure",
  rootCause: null,
  proposedSolution: "Replace the display assembly",
  laborCost: 250_000,
  estimatedHours: 2,
  dataLossRisk: false,
  riskNote: null,
  status: "DRAFT" as const,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  parts: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("diagnosis API", () => {
  it("allows a technician to create a validated diagnosis", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 6,
      email: "technician@example.com",
      role: "TECHNICIAN",
      sessionId,
    });
    const create = vi.spyOn(diagnosisService, "create").mockResolvedValue(diagnosis);

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/diagnoses`)
      .set("Authorization", "Bearer technician-token")
      .send({
        actualIssue: "Display assembly failure",
        proposedSolution: "Replace the display assembly",
      });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 6, role: "TECHNICIAN" }),
      10,
      expect.objectContaining({ laborCost: 0, dataLossRisk: false, parts: [] }),
      expect.anything(),
    );
  });

  it("rejects duplicate diagnosis parts before the service", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 6,
      email: "technician@example.com",
      role: "TECHNICIAN",
      sessionId,
    });
    const create = vi.spyOn(diagnosisService, "create");

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/diagnoses`)
      .set("Authorization", "Bearer technician-token")
      .send({
        actualIssue: "Display assembly failure",
        proposedSolution: "Replace the display assembly",
        parts: [
          { partId: 4, quantity: 1 },
          { partId: 4, quantity: 2 },
        ],
      });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows an owning customer to list customer-safe diagnoses", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const list = vi.spyOn(diagnosisService, "list").mockResolvedValue([]);

    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/10/diagnoses`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      10,
    );
  });

  it("requires a reason when a manager requests revision", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 5,
      email: "manager@example.com",
      role: "MANAGER",
      sessionId,
    });
    const requestRevision = vi.spyOn(diagnosisService, "requestRevision");

    const response = await request(app)
      .post(`${env.API_PREFIX}/diagnoses/20/request-revision`)
      .set("Authorization", "Bearer manager-token")
      .send({});

    expect(response.status).toBe(422);
    expect(requestRevision).not.toHaveBeenCalled();
  });

  it("blocks receptionists from diagnosis reads", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 4,
      email: "receptionist@example.com",
      role: "RECEPTIONIST",
      sessionId,
    });
    const list = vi.spyOn(diagnosisService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/10/diagnoses`)
      .set("Authorization", "Bearer receptionist-token");

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
