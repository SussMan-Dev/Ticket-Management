import type { Quotation, QuotationStatus, UserRole } from "../../types/domain";

export type QuotationAction = "EDIT" | "SUBMIT" | "APPROVE" | "SEND" | "ACCEPT" | "REJECT";

export function isQuotationExpired(quotation: Pick<Quotation, "expiresAt" | "status">, now = new Date()): boolean {
  return quotation.status === "EXPIRED" ||
    (quotation.status === "SENT" && !!quotation.expiresAt && new Date(quotation.expiresAt) <= now);
}

export function visibleQuotationActions(
  role: UserRole,
  quotation: Pick<Quotation, "status" | "expiresAt">,
  now = new Date(),
): QuotationAction[] {
  if (isQuotationExpired(quotation, now) || quotation.status === "SUPERSEDED") return [];
  const byStatus: Partial<Record<QuotationStatus, QuotationAction[]>> = {
    DRAFT: role === "MANAGER" ? ["EDIT", "SUBMIT"] : [],
    PENDING_APPROVAL: role === "MANAGER" ? ["APPROVE"] : [],
    APPROVED: role === "MANAGER" ? ["SEND"] : [],
    SENT: role === "CUSTOMER" ? ["ACCEPT", "REJECT"] : [],
  };
  return byStatus[quotation.status] ?? [];
}

export function isQuotationReadOnly(quotation: Pick<Quotation, "status" | "expiresAt">): boolean {
  return quotation.status !== "DRAFT" || isQuotationExpired(quotation);
}
