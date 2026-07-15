import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { notificationService } from "../src/modules/notifications/notification.service.js";

const actor = { id: 2, email: "customer@example.com", role: "CUSTOMER" as const, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" };
const notification = { id: 3, type: "PAYMENT_UPDATE", title: "Paid", content: "Invoice paid", reference: { type: "INVOICE", id: 4 }, isRead: true, readAt: new Date(), createdAt: new Date() };
afterEach(() => vi.restoreAllMocks());
function authenticate() { vi.spyOn(authService, "authenticate").mockResolvedValue(actor); }

describe("notifications API", () => {
  it("lists only through the authenticated recipient scope", async () => {
    authenticate();
    const list = vi.spyOn(notificationService, "list").mockResolvedValue({ notifications: [notification], total: 1 });
    const response = await request(app).get(`${env.API_PREFIX}/notifications?page=1&limit=15&isRead=false`).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ total: 1, page: 1 });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), expect.objectContaining({ isRead: false }));
  });

  it("marks one notification as read", async () => {
    authenticate();
    const mark = vi.spyOn(notificationService, "markRead").mockResolvedValue(notification);
    const response = await request(app).patch(`${env.API_PREFIX}/notifications/3/read`).set("Authorization", "Bearer token").send({});
    expect(response.status).toBe(200);
    expect(mark).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 3);
  });

  it("requires authentication for unread counts", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/notifications/unread-count`);
    expect(response.status).toBe(401);
  });
});
