import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("application foundation", () => {
  it("returns the standard success envelope for the health endpoint", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Service is healthy",
      data: { status: "ok" },
      meta: null,
    });
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("returns the standard error envelope for an unknown route", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/missing`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: `Route GET ${env.API_PREFIX}/missing was not found`,
      error: {
        code: "ROUTE_NOT_FOUND",
        details: null,
      },
    });
  });

  it("returns a safe client error for malformed JSON", async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/missing`)
      .set("Content-Type", "application/json")
      .send('{"invalid":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Request body contains invalid JSON",
      error: {
        code: "INVALID_JSON",
        details: null,
      },
    });
  });
});
