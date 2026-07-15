import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { authApi } from "../../features/auth/auth.api";
import type { AuthPayload } from "../../types/api";
import type { SafeUser } from "../../types/domain";
import { server } from "../../test/server";
import { ApiError } from "./api-error";
import { apiClient } from "./client";
import { tokenStore } from "./token-store";

const user: SafeUser = {
  id: 7, fullName: "Nguyễn Minh", email: "minh@example.com", phone: null,
  role: "CUSTOMER", status: "ACTIVE", avatarUrl: null, lastLoginAt: null,
  createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z",
};

function success<T>(data: T) {
  return { success: true, message: "OK", data, meta: null };
}

function authPayload(token: string): AuthPayload {
  return { user, accessToken: token, accessTokenExpiresAt: "2026-07-15T01:00:00.000Z" };
}

describe("API auth transport", () => {
  it("đăng nhập giữ access token trong memory và logout xóa token", async () => {
    let logoutCredentials = "";
    server.use(
      http.post("http://localhost:3000/api/v1/auth/login", () => HttpResponse.json(success(authPayload("access-1")))),
      http.post("http://localhost:3000/api/v1/auth/logout", ({ request }) => {
        logoutCredentials = request.credentials;
        return HttpResponse.json(success(null));
      }),
    );
    await authApi.login({ email: "minh@example.com", password: "Password1" });
    expect(tokenStore.get()).toBe("access-1");
    await authApi.logout();
    expect(tokenStore.get()).toBeNull();
    expect(logoutCredentials).toBe("include");
  });

  it("single-flight refresh và retry hai request cũ đúng một lần", async () => {
    let refreshCount = 0;
    let protectedCount = 0;
    tokenStore.set("expired");
    server.use(
      http.get("http://localhost:3000/api/v1/protected", ({ request }) => {
        protectedCount += 1;
        if (request.headers.get("authorization") === "Bearer fresh") return HttpResponse.json(success({ value: "ok" }));
        return HttpResponse.json({ success: false, message: "Expired", error: { code: "AUTH_TOKEN_EXPIRED", details: null } }, { status: 401 });
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh-token", async () => {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json(success(authPayload("fresh")));
      }),
    );
    const [first, second] = await Promise.all([
      apiClient.get<{ value: string }>("/protected"),
      apiClient.get<{ value: string }>("/protected"),
    ]);
    expect(first.data.value).toBe("ok");
    expect(second.data.value).toBe("ok");
    expect(refreshCount).toBe(1);
    expect(protectedCount).toBe(4);
  });

  it("giữ nguyên status, code và details của error envelope", async () => {
    server.use(http.patch("http://localhost:3000/api/v1/conflict", () => HttpResponse.json({ success: false, message: "Stale state", error: { code: "CONFLICT", details: { currentStatus: "SUBMITTED" } } }, { status: 409 })));
    const error = await apiClient.patch("/conflict", {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "CONFLICT", details: { currentStatus: "SUBMITTED" } });
  });
});
