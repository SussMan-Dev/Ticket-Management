export const PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
