export const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
