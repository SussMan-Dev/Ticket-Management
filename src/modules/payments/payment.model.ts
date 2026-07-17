import type { RowDataPacket } from "mysql2";

export const INVOICE_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "E_WALLET",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface InvoiceRow extends RowDataPacket {
  id: number;
  invoice_code: string;
  ticket_id: number;
  ticket_code: string;
  ticket_status: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: InvoicePaymentStatus;
  created_by: number;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRow extends RowDataPacket {
  id: number;
  payment_code: string;
  invoice_id: number;
  ticket_id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_reference: string | null;
  received_by: number;
  received_by_name: string;
  paid_at: Date;
  note: string | null;
  created_at: Date;
}

export interface AcceptedQuotationSnapshotRow extends RowDataPacket {
  id: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

export interface AcceptedQuotationItemPricingRow extends RowDataPacket {
  item_type: "LABOR" | "PART" | "OTHER";
  description: string;
  part_id: number | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface FulfilledPartTotalRow extends RowDataPacket {
  part_id: number;
  part_sku: string;
  part_name: string;
  part_unit: string;
  quantity: number;
  unit_price: number;
}

export interface ActiveManagerRow extends RowDataPacket {
  id: number;
  full_name: string;
}

export interface Invoice {
  id: number;
  invoiceCode: string;
  ticket: { id: number; ticketCode: string; status: string };
  customer: { id: number; fullName: string; email: string };
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: InvoicePaymentStatus;
  createdBy: { id: number; fullName: string };
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceCostLineType = "LABOR" | "OTHER" | "PART";
export type InvoiceCostLineSource =
  | "ACCEPTED_QUOTATION"
  | "FULFILLED_PART_REQUEST";

export interface InvoiceCostLine {
  type: InvoiceCostLineType;
  description: string;
  part: {
    id: number;
    sku: string;
    name: string;
    unit: string;
  } | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  source: InvoiceCostLineSource;
}

export interface InvoiceCostBreakdown {
  lines: InvoiceCostLine[];
  serviceSubtotal: number;
  partSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface InvoicePreview {
  ticket: { id: number; ticketCode: string; title: string };
  customer: { id: number; fullName: string };
  costBreakdown: InvoiceCostBreakdown;
}

export interface InvoiceDetail extends Invoice {
  costBreakdown: InvoiceCostBreakdown;
}

export interface Payment {
  id: number;
  paymentCode: string;
  invoiceId: number;
  ticketId: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference: string | null;
  receivedBy: { id: number; fullName: string };
  paidAt: Date;
  note: string | null;
  createdAt: Date;
}

export interface RefundApprover {
  id: number;
  fullName: string;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    invoiceCode: row.invoice_code,
    ticket: {
      id: row.ticket_id,
      ticketCode: row.ticket_code,
      status: row.ticket_status,
    },
    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
      email: row.customer_email,
    },
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    balanceAmount: money(row.total_amount - row.paid_amount),
    paymentStatus: row.payment_status,
    createdBy: { id: row.created_by, fullName: row.created_by_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    paymentCode: row.payment_code,
    invoiceId: row.invoice_id,
    ticketId: row.ticket_id,
    amount: row.amount,
    method: row.method,
    status: row.status,
    transactionReference: row.transaction_reference,
    receivedBy: { id: row.received_by, fullName: row.received_by_name },
    paidAt: row.paid_at,
    note: row.note,
    createdAt: row.created_at,
  };
}
