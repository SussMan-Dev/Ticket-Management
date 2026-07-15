import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { RepairTicketRow } from "../src/modules/repair-tickets/repair-ticket.model.js";
import type { RepairTicketRepository } from "../src/modules/repair-tickets/repair-ticket.repository.js";
import { RepairTicketService } from "../src/modules/repair-tickets/repair-ticket.service.js";

const connection = {} as PoolConnection;
const customer = {
  id: 2,
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  sessionId: "2c7063b2-cd1e-4f65-a4a1-28c1ab59b1c6",
};
const otherCustomer = {
  ...customer,
  id: 3,
  email: "other@example.com",
};
const receptionist = {
  id: 4,
  email: "receptionist@example.com",
  role: "RECEPTIONIST" as const,
  sessionId: "c41456d7-dbc8-42df-8668-cce2a7cb35f1",
};
const manager = {
  id: 5,
  email: "manager@example.com",
  role: "MANAGER" as const,
  sessionId: "47cb6cce-9789-4225-ac66-ab856ef49f93",
};
const technician = {
  id: 6,
  email: "technician@example.com",
  role: "TECHNICIAN" as const,
  sessionId: "775258a7-12e0-49c4-916d-3f58d6574a19",
};
const cashier = {
  id: 7,
  email: "cashier@example.com",
  role: "CASHIER" as const,
  sessionId: "994efcd7-1953-4161-8124-aa32ee32b257",
};

function row(overrides: Record<string, unknown> = {}): RepairTicketRow {
  const now = new Date();
  return {
    id: 10,
    ticket_code: "RT-2026-000010",
    customer_id: 2,
    customer_name: "Customer User",
    device_id: 7,
    device_model: "Model X",
    device_serial_number: "SERIAL-1",
    device_category: "Smartphone",
    device_brand: "Example Brand",
    created_by: 2,
    creator_name: "Customer User",
    title: "Screen is broken",
    customer_issue: "The screen does not display anything",
    initial_condition: null,
    accessories_received: null,
    status: "NEW",
    priority: "NORMAL",
    expected_diagnosis_at: null,
    expected_completion_at: null,
    received_at: null,
    completed_at: null,
    delivered_at: null,
    closed_at: null,
    cancellation_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as RepairTicketRow;
}

function dependencies() {
  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findCustomer: vi.fn(),
    findAvailableDeviceForCustomer: vi.fn(),
    hasActiveAssignment: vi.fn(),
    create: vi.fn(),
    setTicketCode: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    createStatusHistory: vi.fn(),
    listStatusHistory: vi.fn(),
    listAttachments: vi.fn(),
    createAttachment: vi.fn(),
    findAttachmentById: vi.fn(),
  };
  const transaction = vi.fn(async <T>(callback: (value: PoolConnection) => Promise<T>) =>
    callback(connection),
  );
  const service = new RepairTicketService(
    repository as unknown as RepairTicketRepository,
    transaction as unknown as <T>(
      callback: (value: PoolConnection) => Promise<T>,
    ) => Promise<T>,
  );

  return { service, repository, transaction };
}

describe("RepairTicketService", () => {
  it("scopes customer, technician, and cashier lists at the repository boundary", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValue({ rows: [row()], total: 1 });
    const query = {
      page: 1,
      limit: 20,
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
    };

    await deps.service.list(customer, query);
    expect(deps.repository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ customerId: 2 }),
    );

    await deps.service.list(technician, query);
    expect(deps.repository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ assignedTechnicianId: 6 }),
    );

    await deps.service.list(cashier, query);
    expect(deps.repository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("rejects cashier attempts to broaden the billing ticket scope", async () => {
    const deps = dependencies();
    await expect(deps.service.list(cashier, {
      page: 1,
      limit: 20,
      status: "REPAIRING",
      sortBy: "createdAt",
      sortOrder: "desc",
    })).rejects.toMatchObject({ code: "BILLING_TICKET_SCOPE_REQUIRED" });
    expect(deps.repository.list).not.toHaveBeenCalled();
  });

  it("blocks cross-customer detail and requires an active technician assignment", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());

    await expect(deps.service.getById(otherCustomer, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    deps.repository.hasActiveAssignment.mockResolvedValue(false);
    await expect(deps.service.getById(technician, 10)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    deps.repository.hasActiveAssignment.mockResolvedValue(true);
    await expect(deps.service.getById(technician, 10)).resolves.toMatchObject({ id: 10 });
  });

  it("creates an owned ticket and initial history atomically", async () => {
    const deps = dependencies();
    deps.repository.findAvailableDeviceForCustomer.mockResolvedValue({
      id: 7,
      customer_id: 2,
    });
    deps.repository.create.mockResolvedValue(10);
    deps.repository.findById.mockResolvedValue(row());

    const created = await deps.service.create(customer, {
      deviceId: 7,
      title: "Screen is broken",
      customerIssue: "The screen does not display anything",
      priority: "NORMAL",
      receiveNow: false,
    });

    expect(created.status).toBe("NEW");
    expect(deps.transaction).toHaveBeenCalledOnce();
    expect(deps.repository.findAvailableDeviceForCustomer).toHaveBeenCalledWith(
      connection,
      7,
      2,
    );
    expect(deps.repository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        customerId: 2,
        createdBy: 2,
        status: "NEW",
        placeholderCode: expect.stringMatching(/^TMP-/),
      }),
    );
    expect(deps.repository.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ fromStatus: null, toStatus: "NEW" }),
    );
  });

  it("rejects cross-owner devices and customer-controlled staff fields", async () => {
    const deps = dependencies();

    await expect(
      deps.service.create(customer, {
        customerId: 3,
        deviceId: 7,
        title: "Screen is broken",
        customerIssue: "The screen does not display anything",
        priority: "NORMAL",
        receiveNow: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      deps.service.create(customer, {
        deviceId: 7,
        title: "Screen is broken",
        customerIssue: "The screen does not display anything",
        priority: "URGENT",
        receiveNow: false,
      }),
    ).rejects.toMatchObject({ code: "STAFF_FIELDS_FORBIDDEN" });
  });

  it("allows a receptionist to create and receive an intake ticket", async () => {
    const deps = dependencies();
    deps.repository.findAvailableDeviceForCustomer.mockResolvedValue({
      id: 7,
      customer_id: 2,
    });
    deps.repository.create.mockResolvedValue(10);
    deps.repository.findById.mockResolvedValue(row({ status: "RECEIVED" }));

    const created = await deps.service.create(receptionist, {
      customerId: 2,
      deviceId: 7,
      title: "Screen is broken",
      customerIssue: "The screen does not display anything",
      priority: "HIGH",
      receiveNow: true,
    });

    expect(created.status).toBe("RECEIVED");
    expect(deps.repository.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ toStatus: "RECEIVED" }),
    );
  });

  it("limits customer updates to owned NEW ticket fields", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ title: "Updated title" }));

    await expect(
      deps.service.update(customer, 10, { title: "Updated title" }),
    ).resolves.toMatchObject({ title: "Updated title" });

    deps.repository.findById.mockResolvedValue(row({ status: "RECEIVED" }));
    await expect(
      deps.service.update(customer, 10, { title: "Too late" }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_EDITABLE" });
  });

  it("receives a NEW ticket with status history in one transaction", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "RECEIVED", received_at: new Date() }));

    const received = await deps.service.receive(receptionist, 10, "Device received");

    expect(received.status).toBe("RECEIVED");
    expect(deps.repository.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "RECEIVED",
      null,
    );
    expect(deps.repository.createStatusHistory).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ fromStatus: "NEW", toStatus: "RECEIVED" }),
    );
  });

  it("allows only Phase 4 manager hold transitions", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row({ status: "RECEIVED" }));

    await expect(
      deps.service.changeStatus(manager, 10, "ASSIGNED", "Assign now"),
    ).rejects.toMatchObject({ code: "STATUS_TRANSITION_NOT_AVAILABLE" });

    deps.repository.findById
      .mockReset()
      .mockResolvedValueOnce(row({ status: "RECEIVED" }))
      .mockResolvedValueOnce(row({ status: "ON_HOLD" }));
    await expect(
      deps.service.changeStatus(manager, 10, "ON_HOLD", "Waiting for customer"),
    ).resolves.toMatchObject({ status: "ON_HOLD" });
  });

  it("allows an owner to cancel only a NEW ticket", async () => {
    const deps = dependencies();
    deps.repository.findById
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ status: "CANCELLED", cancellation_reason: "No longer needed" }),
      );

    await expect(
      deps.service.cancel(customer, 10, "No longer needed"),
    ).resolves.toMatchObject({ status: "CANCELLED" });
    expect(deps.repository.updateStatus).toHaveBeenCalledWith(
      connection,
      10,
      "CANCELLED",
      "No longer needed",
    );

    deps.repository.findById.mockResolvedValue(row({ status: "RECEIVED" }));
    await expect(
      deps.service.cancel(customer, 10, "No longer needed"),
    ).rejects.toMatchObject({ code: "TICKET_CANNOT_BE_CANCELLED" });
  });

  it("enforces attachment type and terminal-state rules", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());

    await expect(
      deps.service.createAttachment(customer, 10, {
        attachmentType: "BEFORE_REPAIR",
        fileUrl: "https://example.com/device.jpg",
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_TYPE_FORBIDDEN" });

    deps.repository.findById.mockResolvedValue(row({ status: "CANCELLED" }));
    await expect(
      deps.service.createAttachment(customer, 10, {
        attachmentType: "CUSTOMER_ATTACHMENT",
        fileUrl: "https://example.com/device.jpg",
      }),
    ).rejects.toMatchObject({ code: "TICKET_TERMINAL" });
  });

  it("creates authorized attachment metadata atomically", async () => {
    const deps = dependencies();
    deps.repository.findById.mockResolvedValue(row());
    deps.repository.createAttachment.mockResolvedValue(20);
    deps.repository.findAttachmentById.mockResolvedValue({
      id: 20,
      ticket_id: 10,
      uploaded_by: 2,
      uploaded_by_name: "Customer User",
      uploaded_by_role: "CUSTOMER",
      attachment_type: "CUSTOMER_ATTACHMENT",
      file_url: "https://example.com/device.jpg",
      file_name: "device.jpg",
      mime_type: "image/jpeg",
      created_at: new Date(),
    });

    const attachment = await deps.service.createAttachment(customer, 10, {
      attachmentType: "CUSTOMER_ATTACHMENT",
      fileUrl: "https://example.com/device.jpg",
      fileName: "device.jpg",
      mimeType: "image/jpeg",
    });

    expect(attachment.id).toBe(20);
    expect(deps.repository.createAttachment).toHaveBeenCalledWith(
      connection,
      10,
      2,
      expect.objectContaining({ attachmentType: "CUSTOMER_ATTACHMENT" }),
    );
  });
});
