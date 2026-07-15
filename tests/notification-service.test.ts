import { describe, expect, it, vi } from "vitest";
import type { NotificationRepository } from "../src/modules/notifications/notification.repository.js";
import { NotificationService } from "../src/modules/notifications/notification.service.js";

const actor = { id: 2, email: "customer@example.com", role: "CUSTOMER" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };
const row = { id: 3, user_id: 2, type: "UPDATE", title: "Update", content: "Changed", reference_type: "REPAIR_TICKET", reference_id: 10, is_read: 0, read_at: null, created_at: new Date() };

describe("NotificationService", () => {
  it("scopes reads and writes by authenticated user id", async () => {
    const repository = { findOwnedById: vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, is_read: 1, read_at: new Date() }), markRead: vi.fn() };
    const service = new NotificationService(repository as unknown as NotificationRepository);
    const result = await service.markRead(actor, 3);
    expect(result.isRead).toBe(true);
    expect(repository.markRead).toHaveBeenCalledWith(expect.anything(), 3, 2);
  });

  it("does not reveal another recipient's notification", async () => {
    const repository = { findOwnedById: vi.fn().mockResolvedValue(null) };
    const service = new NotificationService(repository as unknown as NotificationRepository);
    await expect(service.markRead(actor, 99)).rejects.toMatchObject({ code: "NOTIFICATION_NOT_FOUND" });
  });
});
