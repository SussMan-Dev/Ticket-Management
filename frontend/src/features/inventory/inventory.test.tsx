import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { navigationForRole } from "../../layouts/role-navigation";
import type { Part, PartRequest } from "../../types/domain";
import { useCreatePartRequest } from "./inventory.api";
import { useStockIn } from "../parts/parts.api";

const partRequest: PartRequest = {
  id: 15,
  ticket: { id: 10, ticketCode: "RT-2026-000010" },
  requestedBy: { id: 6, fullName: "Technician" },
  status: "PENDING",
  note: null,
  approvedBy: null,
  approvedAt: null,
  items: [],
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
};

const part: Part = {
  id: 4,
  sku: "LCD-1",
  name: "Display",
  description: null,
  unit: "piece",
  purchasePrice: 200,
  sellingPrice: 300,
  quantityOnHand: 8,
  minimumStock: 2,
  isLowStock: false,
  isActive: true,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Phase 7 frontend integration", () => {
  it("replaces the inventory extension point with catalog and request navigation", () => {
    const inventoryPaths = navigationForRole("INVENTORY_STAFF").map((item) => item.to);
    expect(inventoryPaths).toContain("/parts");
    expect(inventoryPaths).toContain("/part-requests");
    expect(inventoryPaths).not.toContain("/extension");
  });

  it("creates a ticket-scoped request and invalidates request/ticket/history caches", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      message: "created",
      data: partRequest,
      meta: null,
    } as never);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreatePartRequest(10), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        items: [{ partId: 4, requestedQuantity: 2 }],
      });
    });

    expect(post).toHaveBeenCalledWith("/repair-tickets/10/part-requests", {
      items: [{ partId: 4, requestedQuantity: 2 }],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["part-requests"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticket(10) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticketHistory(10) });
  });

  it("stock-in uses the ledger endpoint and invalidates the part catalog", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      message: "stocked",
      data: part,
      meta: null,
    } as never);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useStockIn(4), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ quantity: 3, note: "Supplier receipt" });
    });

    expect(post).toHaveBeenCalledWith("/parts/4/stock-in", {
      quantity: 3,
      note: "Supplier receipt",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["parts"] });
  });
});
