import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/modules/auth/auth.service.js";
import { reviewService } from "../src/modules/reviews/review.service.js";

const review = { id: 9, ticket: { id: 10, ticketCode: "RT-10" }, customer: { id: 2, fullName: "Customer" }, rating: 5, technicianRating: 5, serviceRating: 4, comment: "Good", createdAt: new Date(), updatedAt: new Date() };
afterEach(() => vi.restoreAllMocks());
function authenticate(role: "CUSTOMER" | "MANAGER") { vi.spyOn(authService, "authenticate").mockResolvedValue({ id: role === "CUSTOMER" ? 2 : 5, email: `${role}@example.com`, role, sessionId: "841922bd-d85c-40e7-952e-a8615676375a" }); }

describe("reviews API", () => {
  it("lets a customer review a delivered ticket", async () => {
    authenticate("CUSTOMER");
    const create = vi.spyOn(reviewService, "create").mockResolvedValue(review);
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/review`).set("Authorization", "Bearer token").send({ rating: 5, technicianRating: 5, serviceRating: 4, comment: "Good" });
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 10, expect.objectContaining({ rating: 5 }), expect.anything());
  });

  it("validates rating bounds", async () => {
    authenticate("CUSTOMER");
    const create = vi.spyOn(reviewService, "create");
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/review`).set("Authorization", "Bearer token").send({ rating: 6 });
    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps review writes customer-only", async () => {
    authenticate("MANAGER");
    const response = await request(app).post(`${env.API_PREFIX}/repair-tickets/10/review`).set("Authorization", "Bearer token").send({ rating: 5 });
    expect(response.status).toBe(403);
  });
});
