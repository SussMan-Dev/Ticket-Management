import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../lib/auth/auth-context";
import { navigationForRole } from "../layouts/role-navigation";
import type { SafeUser } from "../types/domain";
import { ProtectedRoute, RoleRoute } from "./route-guards";

const user: SafeUser = { id: 1, fullName: "Test User", email: "test@example.com", phone: null, role: "CUSTOMER", status: "ACTIVE", avatarUrl: null, lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
function value(overrides: Partial<AuthContextValue>): AuthContextValue {
  return { status: "anonymous", user: null, login: vi.fn(), logout: vi.fn(), updateCurrentUser: vi.fn(), ...overrides };
}

describe("route guards và role navigation", () => {
  it("đưa phiên anonymous về login", () => {
    render(<AuthContext.Provider value={value({})}><MemoryRouter initialEntries={["/private"]}><Routes><Route path="/login" element={<div>Login target</div>} /><Route path="/private" element={<ProtectedRoute><div>Private</div></ProtectedRoute>} /></Routes></MemoryRouter></AuthContext.Provider>);
    expect(screen.getByText("Login target")).toBeInTheDocument();
  });

  it("chặn role không hợp lệ bằng forbidden", () => {
    render(<AuthContext.Provider value={value({ status: "authenticated", user })}><MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/forbidden" element={<div>Forbidden target</div>} /><Route path="/admin" element={<RoleRoute roles={["ADMIN"]}><div>Admin</div></RoleRoute>} /></Routes></MemoryRouter></AuthContext.Provider>);
    expect(screen.getByText("Forbidden target")).toBeInTheDocument();
  });

  it("Admin chỉ thấy quản trị tài khoản, Manager thấy vận hành", () => {
    const admin = navigationForRole("ADMIN").map((item) => item.to);
    const manager = navigationForRole("MANAGER").map((item) => item.to);
    expect(admin).toContain("/users");
    expect(admin).not.toContain("/tickets");
    expect(manager).toContain("/tickets");
    expect(manager).not.toContain("/users");
  });

  it("dùng nhãn tiếng Việt, dễ hiểu trong điều hướng", () => {
    const customerLabels = navigationForRole("CUSTOMER").map((item) => item.label);
    const inventoryLabels = navigationForRole("INVENTORY_STAFF").map((item) => item.label);

    expect(customerLabels).toContain("Trang chủ");
    expect(customerLabels).toContain("Hồ sơ cá nhân");
    expect(inventoryLabels).toContain("Yêu cầu cấp linh kiện");
    expect(inventoryLabels.join(" ")).not.toMatch(/Part requests|Catalog/i);
  });
});
