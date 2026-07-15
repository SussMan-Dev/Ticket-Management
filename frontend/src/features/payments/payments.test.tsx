import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/api/query-keys";
import type { Payment } from "../../types/domain";
import { paymentGateway } from "./payment.gateway";
import { paymentFormSchema, refundFormSchema } from "./payment.schemas";
import { useCreatePayment, useRefundPayment } from "./payments.api";

const payment: Payment = {
  id: 50,
  paymentCode: "PAY-2026-000050",
  invoiceId: 40,
  ticketId: 10,
  amount: 400,
  method: "CASH",
  status: "COMPLETED",
  transactionReference: null,
  receivedBy: { id: 7, fullName: "Cashier" },
  paidAt: "2026-07-15T00:00:00.000Z",
  note: null,
  createdAt: "2026-07-15T00:00:00.000Z",
};

function testQueryClient() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("payment forms and query integration", () => {
  it("accepts positive money with two decimals and rejects extra precision", () => {
    expect(paymentFormSchema.safeParse({ amount: 10.25, method: "CASH" }).success).toBe(true);
    expect(paymentFormSchema.safeParse({ amount: 10.251, method: "CASH" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ amount: 0, method: "CASH" }).success).toBe(false);
  });

  it("requires a manager and an auditable refund reason", () => {
    expect(refundFormSchema.safeParse({ managerApprovalId: 5, reason: "Approved refund" }).success).toBe(true);
    expect(refundFormSchema.safeParse({ managerApprovalId: 0, reason: "No" }).success).toBe(false);
  });

  it("invalidates invoice, payments and ticket state after collecting payment", async () => {
    vi.spyOn(paymentGateway, "createPayment").mockResolvedValue(payment);
    const { queryClient, wrapper } = testQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreatePayment(40), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ amount: 400, method: "CASH" });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.invoice(40) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.invoicePayments(40) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.ticket(10) });
  });

  it("uses the separate refund command and invalidates the same financial state", async () => {
    vi.spyOn(paymentGateway, "refundPayment").mockResolvedValue({ ...payment, status: "REFUNDED" });
    const { queryClient, wrapper } = testQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRefundPayment(40), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        paymentId: 50,
        input: { managerApprovalId: 5, reason: "Approved refund" },
      });
    });

    expect(paymentGateway.refundPayment).toHaveBeenCalledWith(50, {
      managerApprovalId: 5,
      reason: "Approved refund",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.invoice(40) });
  });
});
