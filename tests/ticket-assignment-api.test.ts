import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { ticketAssignmentService } from "../src/modules/ticket-assignments/ticket-assignment.service.js";

const sessionId = "47cb6cce-9789-4225-ac66-ab856ef49f93";
const assignment = {
  id: 30,
  ticketId: 10,
  technician: {
    id: 6,
    fullName: "Technician One",
    email: "technician@example.com",
  },
  assignedBy: { id: 5, fullName: "Manager User" },
  assignedAt: new Date(),
  unassignedAt: null,
  isActive: true,
  note: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ticket assignment API", () => {
  it("returns active technician choices to a manager", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 5, email: "manager@example.com", role: "MANAGER", sessionId,
    });
    const list = vi.spyOn(ticketAssignmentService, "listAssignableTechnicians")
      .mockResolvedValue([{ id: 6, fullName: "Technician One", email: "technician@example.com" }]);
    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/assignable-technicians`)
      .set("Authorization", "Bearer manager-token");
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ id: 6, fullName: "Technician One" });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ role: "MANAGER" }), {});
  });

  it("allows a manager to assign a technician", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 5,
      email: "manager@example.com",
      role: "MANAGER",
      sessionId,
    });
    const assign = vi.spyOn(ticketAssignmentService, "assign").mockResolvedValue(
      assignment,
    );

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/assign`)
      .set("Authorization", "Bearer manager-token")
      .send({ technicianId: 6 });

    expect(response.status).toBe(201);
    expect(assign).toHaveBeenCalledWith(
      expect.objectContaining({ role: "MANAGER" }),
      10,
      { technicianId: 6 },
      expect.objectContaining({ ipAddress: expect.anything() }),
    );
  });

  it("blocks technicians from assignment endpoints", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 6,
      email: "technician@example.com",
      role: "TECHNICIAN",
      sessionId,
    });
    const assign = vi.spyOn(ticketAssignmentService, "assign");

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/assign`)
      .set("Authorization", "Bearer technician-token")
      .send({ technicianId: 8 });

    expect(response.status).toBe(403);
    expect(assign).not.toHaveBeenCalled();

    const lookup = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets/assignable-technicians`)
      .set("Authorization", "Bearer technician-token");
    expect(lookup.status).toBe(403);
  });

  it("requires an audited reason for reassignment", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 5,
      email: "manager@example.com",
      role: "MANAGER",
      sessionId,
    });
    const reassign = vi.spyOn(ticketAssignmentService, "reassign");

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/reassign`)
      .set("Authorization", "Bearer manager-token")
      .send({ technicianId: 8 });

    expect(response.status).toBe(422);
    expect(reassign).not.toHaveBeenCalled();
  });
});
