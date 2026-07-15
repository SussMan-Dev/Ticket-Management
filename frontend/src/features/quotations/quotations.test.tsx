import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/api/query-keys";
import type { Quotation } from "../../types/domain";
import { quotationGateway } from "./quotation.gateway";
import { isQuotationReadOnly, visibleQuotationActions } from "./quotation.rules";
import { useTransitionQuotation } from "./quotations.api";

function quotation(
  status: Quotation["status"],
  expiresAt: string | null = "2099-01-01T00:00:00Z",
): Quotation {
  return {
    id: 1,
    ticketId: 9,
    diagnosisId: 3,
    version: 1,
    status,
    items: [],
    laborAmount: 0,
    partsAmount: 0,
    otherAmount: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    expiresAt,
    createdBy: { id: 5, fullName: "Manager" },
    approvedBy: null,
    approvedAt: null,
    sentAt: null,
    customerRespondedAt: null,
    customerResponseNote: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
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

  it("invalidate quotation list/detail, ticket và status history sau mutation", async () => {
    const quote = quotation("PENDING_APPROVAL");
    vi.spyOn(quotationGateway, "transition").mockResolvedValue(quote);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useTransitionQuotation(9, quote.id),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("PENDING_APPROVAL");
    });

    expect(quotationGateway.transition).toHaveBeenCalledWith(quote.id, "PENDING_APPROVAL");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.quotations(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.quotation(quote.id) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticket(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticketHistory(9) });
  });
});
