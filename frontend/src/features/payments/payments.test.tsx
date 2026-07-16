import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../lib/api/query-keys";
import type { InvoicePreview, Payment } from "../../types/domain";
import { paymentGateway } from "./payment.gateway";
import { paymentFormSchema, refundFormSchema } from "./payment.schemas";
import { useCreatePayment, useInvoicePreview, useRefundPayment } from "./payments.api";

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

const invoicePreview: InvoicePreview = {
  ticket: { id: 10, ticketCode: "RT-2026-000010", title: "Screen failure" },
  customer: { id: 2, fullName: "Customer" },
  costBreakdown: {
    lines: [],
    serviceSubtotal: 400,
    partSubtotal: 300,
    subtotal: 700,
    discountAmount: 100,
    taxAmount: 50,
    totalAmount: 650,
  },
};

function testQueryClient() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("payment forms and query integration", () => {
  it("loads the server-derived preview for the selected completed ticket", async () => {
    vi.spyOn(paymentGateway, "previewInvoice").mockResolvedValue(invoicePreview);
    const { wrapper } = testQueryClient();
    const { result } = renderHook(() => useInvoicePreview(10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(paymentGateway.previewInvoice).toHaveBeenCalledWith(10);
    expect(result.current.data?.costBreakdown).toMatchObject({
      serviceSubtotal: 400,
      partSubtotal: 300,
      totalAmount: 650,
    });
  });

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
