import { apiClient } from "../../lib/api/client";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type {
  Invoice,
  InvoicePaymentStatus,
  Payment,
  PaymentMethod,
  RefundApprover,
} from "../../types/domain";

export interface InvoicesQuery extends PageQuery {
  paymentStatus?: InvoicePaymentStatus;
  customerId?: number;
  ticketId?: number;
}

export interface CreatePaymentInput {
  amount: number;
  method: PaymentMethod;
  transactionReference?: string | null;
  note?: string | null;
}

export interface RefundPaymentInput {
  managerApprovalId: number;
  reason: string;
}

export const paymentGateway = {
  listInvoices(params: InvoicesQuery) {
    return apiClient.get<Invoice[], PaginationMeta>(
      `/invoices${toQueryString(params)}`,
    );
  },
  async getInvoice(id: number) {
    return (await apiClient.get<Invoice>(`/invoices/${id}`)).data;
  },
  async createInvoice(ticketId: number) {
    return (await apiClient.post<Invoice>(`/repair-tickets/${ticketId}/invoices`, {})).data;
  },
  async listPayments(invoiceId: number) {
    return (await apiClient.get<Payment[]>(`/invoices/${invoiceId}/payments`)).data;
  },
  async createPayment(invoiceId: number, input: CreatePaymentInput) {
    return (await apiClient.post<Payment>(`/invoices/${invoiceId}/payments`, input)).data;
  },
  async refundPayment(paymentId: number, input: RefundPaymentInput) {
    return (await apiClient.post<Payment>(`/payments/${paymentId}/refund`, input)).data;
  },
  async listRefundApprovers() {
    return (await apiClient.get<RefundApprover[]>("/payments/refund-approvers")).data;
  },
};

