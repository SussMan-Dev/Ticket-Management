import { z } from "zod";
import {
  INVOICE_PAYMENT_STATUSES,
  PAYMENT_METHODS,
} from "./payment.model.js";

const positiveId = z.coerce.number().int().positive();
const money = z.number().positive().max(9_999_999_999.99).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  "Amount may have at most two decimal places",
);
const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();

export const invoiceIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const paymentIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const ticketInvoiceParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const listInvoicesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(255).optional(),
    paymentStatus: z.enum(INVOICE_PAYMENT_STATUSES).optional(),
    customerId: positiveId.optional(),
    ticketId: positiveId.optional(),
    sortBy: z.enum(["createdAt", "totalAmount", "paymentStatus"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }).strict(),
});

export const createPaymentSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    amount: money,
    method: z.enum(PAYMENT_METHODS),
    transactionReference: optionalText(191),
    note: optionalText(5_000),
  }).strict(),
});

export const refundPaymentSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    managerApprovalId: positiveId,
    reason: z.string().trim().min(3).max(5_000),
  }).strict(),
});

export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>["params"];
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>["params"];
export type TicketInvoiceParams = z.infer<typeof ticketInvoiceParamsSchema>["params"];
export type ListInvoicesQueryInput = z.infer<typeof listInvoicesSchema>["query"];
export type CreatePaymentBody = z.infer<typeof createPaymentSchema>["body"];
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>["body"];
