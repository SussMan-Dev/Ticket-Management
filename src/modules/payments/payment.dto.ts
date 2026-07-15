import type {
  InvoicePaymentStatus,
  PaymentMethod,
} from "./payment.model.js";

export type InvoiceSortField = "createdAt" | "totalAmount" | "paymentStatus";
export type SortOrder = "asc" | "desc";

export interface ListInvoicesQuery {
  page: number;
  limit: number;
  search?: string;
  paymentStatus?: InvoicePaymentStatus;
  customerId?: number;
  ticketId?: number;
  sortBy: InvoiceSortField;
  sortOrder: SortOrder;
}

export interface CreatePaymentDto {
  amount: number;
  method: PaymentMethod;
  transactionReference?: string | null;
  note?: string | null;
}

export interface RefundPaymentDto {
  managerApprovalId: number;
  reason: string;
}

