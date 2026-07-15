import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/api/query-keys";
import type { Quotation } from "../../types/domain";
import { mockQuotationGateway } from "./quotation.gateway";
import { isQuotationReadOnly, visibleQuotationActions } from "./quotation.rules";
import { useTransitionMockQuotation } from "./quotations.api";

function quotation(status: Quotation["status"], expiresAt: string | null = "2099-01-01T00:00:00Z"): Quotation {
  return { id: 1, ticketId: 9, version: 1, status, items: [], laborAmount: 0, partsAmount: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0, expiresAt, sentAt: null, respondedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", source: "mock" };
}

describe("quotation role/status rules", () => {
  it("hiển thị đúng action cho Manager và Customer", () => {
    expect(visibleQuotationActions("MANAGER", quotation("DRAFT"))).toEqual(["EDIT", "SUBMIT"]);
    expect(visibleQuotationActions("MANAGER", quotation("PENDING_APPROVAL"))).toEqual(["APPROVE"]);
    expect(visibleQuotationActions("MANAGER", quotation("APPROVED"))).toEqual(["SEND"]);
    expect(visibleQuotationActions("CUSTOMER", quotation("SENT"))).toEqual(["ACCEPT", "REJECT"]);
    expect(visibleQuotationActions("TECHNICIAN", quotation("SENT"))).toEqual([]);
  });

  it("EXPIRED và SUPERSEDED luôn read-only; SENT hết hạn không phản hồi", () => {
    expect(visibleQuotationActions("CUSTOMER", quotation("SENT", "2020-01-01T00:00:00Z"))).toEqual([]);
    expect(isQuotationReadOnly(quotation("EXPIRED"))).toBe(true);
    expect(isQuotationReadOnly(quotation("SUPERSEDED"))).toBe(true);
  });

  it("chỉ cho sửa DRAFT trong mock adapter và supersede phiên bản cũ", async () => {
    const first = await mockQuotationGateway.createDraft({ ticketId: 9, expiresAt: null, items: [{ itemType: "LABOR", description: "Công sửa", quantity: 1, unitPrice: 100 }] });
    const updated = await mockQuotationGateway.updateDraft(first.id, { ticketId: 9, expiresAt: null, items: [{ itemType: "LABOR", description: "Công sửa mới", quantity: 2, unitPrice: 100 }] });
    expect(updated.totalAmount).toBe(200);
    const second = await mockQuotationGateway.createDraft({ ticketId: 9, expiresAt: null, items: [{ itemType: "PART", description: "Linh kiện", quantity: 1, unitPrice: 300 }] });
    expect(second.version).toBe(2);
    expect((await mockQuotationGateway.get(first.id))?.status).toBe("SUPERSEDED");
  });

  it("invalidate quotation list/detail, ticket và status history sau mutation", async () => {
    const quote = await mockQuotationGateway.createDraft({ ticketId: 9, expiresAt: null, items: [{ itemType: "LABOR", description: "Công", quantity: 1, unitPrice: 100 }] });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useTransitionMockQuotation(9, quote.id), { wrapper });
    await act(async () => { await result.current.mutateAsync("PENDING_APPROVAL"); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.quotations(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.quotation(quote.id) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticket(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticketHistory(9) });
  });
});
