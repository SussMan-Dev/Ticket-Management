import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/api/query-keys";
import {
  paymentGateway,
  type CreatePaymentInput,
  type InvoicesQuery,
  type RefundPaymentInput,
} from "./payment.gateway";

export function useInvoices(params: InvoicesQuery) {
  return useQuery({
    queryKey: queryKeys.invoices(params),
    queryFn: () => paymentGateway.listInvoices(params),
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => paymentGateway.getInvoice(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useInvoicePayments(invoiceId: number) {
  return useQuery({
    queryKey: queryKeys.invoicePayments(invoiceId),
    queryFn: () => paymentGateway.listPayments(invoiceId),
    enabled: Number.isInteger(invoiceId) && invoiceId > 0,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => paymentGateway.createInvoice(ticketId),
    onSuccess: async (invoice) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(invoice.ticket.id) }),
      ]);
    },
  });
}

function useBillingMutation(invoiceId: number) {
  const queryClient = useQueryClient();
  return async (ticketId: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicePayments(invoiceId) }),
      queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
    ]);
  };
}

export function useCreatePayment(invoiceId: number) {
  const invalidate = useBillingMutation(invoiceId);
  return useMutation({
    mutationFn: (input: CreatePaymentInput) =>
      paymentGateway.createPayment(invoiceId, input),
    onSuccess: async (payment) => invalidate(payment.ticketId),
  });
}

export function useRefundPayment(invoiceId: number) {
  const invalidate = useBillingMutation(invoiceId);
  return useMutation({
    mutationFn: ({ paymentId, input }: {
      paymentId: number;
      input: RefundPaymentInput;
    }) => paymentGateway.refundPayment(paymentId, input),
    onSuccess: async (payment) => invalidate(payment.ticketId),
  });
}

export function useRefundApprovers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.refundApprovers,
    queryFn: paymentGateway.listRefundApprovers,
    enabled,
    staleTime: 5 * 60 * 1_000,
  });
}
