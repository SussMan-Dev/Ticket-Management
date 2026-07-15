import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { repairTicketService } from "../src/modules/repair-tickets/repair-ticket.service.js";

const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";
const ticket = {
  id: 10,
  ticketCode: "RT-2026-000010",
  customer: { id: 2, fullName: "Customer User" },
  device: {
    id: 7,
    model: "Model X",
    serialNumber: null,
    category: "Smartphone",
    brand: null,
  },
  createdBy: { id: 2, fullName: "Customer User" },
  title: "Screen is broken",
  customerIssue: "The screen does not display anything",
  repairAddress: "12 Nguyen Trai, District 1",
  initialCondition: null,
  accessoriesReceived: null,
  status: "NEW" as const,
  priority: "NORMAL" as const,
  expectedDiagnosisAt: null,
  expectedCompletionAt: null,
  receivedAt: null,
  completedAt: null,
  deliveredAt: null,
  closedAt: null,
  cancellationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("repair tickets API", () => {
  it("allows a customer to list tickets through service ownership scoping", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const list = vi.spyOn(repairTicketService, "list").mockResolvedValue({
      tickets: [ticket],
      total: 1,
    });

    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets?page=1&limit=20`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, role: "CUSTOMER" }),
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("creates a validated customer ticket", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const create = vi.spyOn(repairTicketService, "create").mockResolvedValue(ticket);

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets`)
      .set("Authorization", "Bearer customer-token")
      .send({
        deviceId: 7,
        title: "Screen is broken",
        customerIssue: "The screen does not display anything",
        repairAddress: "12 Nguyen Trai, District 1",
      });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ priority: "NORMAL", receiveNow: false }),
    );
  });

  it("uploads a validated ticket image from a technician device", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 6,
      email: "technician@example.com",
      role: "TECHNICIAN",
      sessionId,
    });
    const createAttachmentFile = vi
      .spyOn(repairTicketService, "createAttachmentFile")
      .mockResolvedValue({
        id: 20,
        ticketId: 10,
        uploadedBy: { id: 6, fullName: "Technician", role: "TECHNICIAN" },
        attachmentType: "DURING_REPAIR",
        fileUrl: "http://localhost:3000/uploads/tickets/10/ticket-10-image.png",
        fileName: "repair.png",
        mimeType: "image/png",
        createdAt: new Date(),
      });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/attachment-files`)
      .query({ attachmentType: "DURING_REPAIR", fileName: "repair.png" })
      .set("Authorization", "Bearer technician-token")
      .set("Content-Type", "image/png")
      .send(png);

    expect(response.status).toBe(201);
    expect(createAttachmentFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 6, role: "TECHNICIAN" }),
      10,
      expect.objectContaining({
        attachmentType: "DURING_REPAIR",
        fileName: "repair.png",
        bytes: png,
        mimeType: "image/png",
      }),
    );
  });

  it("routes receive only for receptionists", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 4,
      email: "receptionist@example.com",
      role: "RECEPTIONIST",
      sessionId,
    });
    const receive = vi.spyOn(repairTicketService, "receive").mockResolvedValue({
      ...ticket,
      status: "RECEIVED",
      receivedAt: new Date(),
    });

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/receive`)
      .set("Authorization", "Bearer receptionist-token")
      .send({ reason: "Device received" });

    expect(response.status).toBe(200);
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ role: "RECEPTIONIST" }),
      10,
      "Device received",
    );
  });

  it("rejects invalid attachment URLs before the service", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const createAttachment = vi.spyOn(repairTicketService, "createAttachment");

    const response = await request(app)
      .post(`${env.API_PREFIX}/repair-tickets/10/attachments`)
      .set("Authorization", "Bearer customer-token")
      .send({
        attachmentType: "CUSTOMER_ATTACHMENT",
        fileUrl: "file:///etc/passwd",
      });

    expect(response.status).toBe(422);
    expect(createAttachment).not.toHaveBeenCalled();
  });

  it("blocks administrators from operational ticket endpoints", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 1,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId,
    });
    const list = vi.spyOn(repairTicketService, "list");

    const response = await request(app)
      .get(`${env.API_PREFIX}/repair-tickets`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("mounts the deferred customer ticket collection endpoint", async () => {
    vi.spyOn(authService, "authenticate").mockResolvedValue({
      id: 2,
      email: "customer@example.com",
      role: "CUSTOMER",
      sessionId,
    });
    const listForCustomer = vi
      .spyOn(repairTicketService, "listForCustomer")
      .mockResolvedValue({ tickets: [ticket], total: 1 });

    const response = await request(app)
      .get(`${env.API_PREFIX}/customers/2/tickets?page=1&limit=20`)
      .set("Authorization", "Bearer customer-token");

    expect(response.status).toBe(200);
    expect(listForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      2,
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });
});
