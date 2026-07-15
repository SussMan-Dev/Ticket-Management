import type { RowDataPacket } from "mysql2";
import type { QuotationItemType } from "./quotation.dto.js";

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

export interface QuotationRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  diagnosis_id: number;
  version: number;
  status: QuotationStatus;
  labor_amount: number;
  parts_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  expires_at: Date | null;
  created_by: number;
  created_by_name: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  sent_at: Date | null;
  customer_responded_at: Date | null;
  customer_response_note: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface QuotationItemRow extends RowDataPacket {
  id: number;
  quotation_id: number;
  item_type: QuotationItemType;
  part_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: Date;
}

export interface ApprovedDiagnosisSnapshotRow extends RowDataPacket {
  id: number;
  proposed_solution: string;
  labor_cost: number;
}

export interface CatalogPartSnapshotRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  selling_price: number;
  quantity?: number;
}

export interface QuotationItemRecord {
  itemType: QuotationItemType;
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuotationItem {
  id: number;
  itemType: QuotationItemType;
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: Date;
}

export interface Quotation {
  id: number;
  ticketId: number;
  diagnosisId: number;
  version: number;
  status: QuotationStatus;
  laborAmount: number;
  partsAmount: number;
  otherAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  expiresAt: Date | null;
  createdBy: { id: number; fullName: string };
  approvedBy: { id: number; fullName: string } | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  customerRespondedAt: Date | null;
  customerResponseNote: string | null;
  items: QuotationItem[];
  createdAt: Date;
  updatedAt: Date;
}

export function toQuotationItem(row: QuotationItemRow): QuotationItem {
  return {
    id: row.id,
    itemType: row.item_type,
    partId: row.part_id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    createdAt: row.created_at,
  };
}

export function toQuotation(
  row: QuotationRow,
  itemRows: QuotationItemRow[],
  now = new Date(),
): Quotation {
  const items = itemRows.map(toQuotationItem);
  const effectivelyExpired =
    row.status === "SENT" &&
    row.expires_at !== null &&
    row.expires_at.getTime() <= now.getTime();

  return {
    id: row.id,
    ticketId: row.ticket_id,
    diagnosisId: row.diagnosis_id,
    version: row.version,
    status: effectivelyExpired ? "EXPIRED" : row.status,
    laborAmount: row.labor_amount,
    partsAmount: row.parts_amount,
    otherAmount: Math.round(items
      .filter((item) => item.itemType === "OTHER")
      .reduce((total, item) => total + item.lineTotal, 0) * 100) / 100,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    expiresAt: row.expires_at,
    createdBy: { id: row.created_by, fullName: row.created_by_name },
    approvedBy:
      row.approved_by && row.approved_by_name
        ? { id: row.approved_by, fullName: row.approved_by_name }
        : null,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    customerRespondedAt: row.customer_responded_at,
    customerResponseNote: row.customer_response_note,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
