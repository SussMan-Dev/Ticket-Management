import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../lib/auth/auth-context";
import type { SafeUser } from "../../types/domain";
import { server } from "../../test/server";
import { TicketCreatePage } from "./ticket-create-page";

const customer: SafeUser = { id: 12, fullName: "Khách Hàng", email: "customer@example.com", phone: null, role: "CUSTOMER", status: "ACTIVE", avatarUrl: null, lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

describe("customer ownership UI", () => {
  it("không hiển thị customerId, priority hoặc SLA cho khách hàng", async () => {
    server.use(http.get("http://localhost:3000/api/v1/devices", () => HttpResponse.json({ success: true, message: "OK", data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={{ status: "authenticated", user: customer, login: vi.fn(), logout: vi.fn(), updateCurrentUser: vi.fn() }}><MemoryRouter><TicketCreatePage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>);
    expect(screen.queryByLabelText("Khách hàng")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mức ưu tiên")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Dự kiến chẩn đoán")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Địa chỉ sửa chữa/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Thiết bị/)).toBeInTheDocument();
  });
});
