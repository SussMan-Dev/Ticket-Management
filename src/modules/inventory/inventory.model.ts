import type { RowDataPacket } from "mysql2";

export const PART_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "REJECTED",
  "CANCELLED",
] as const;

export type PartRequestStatus = (typeof PART_REQUEST_STATUSES)[number];

export interface PartRequestRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  ticket_code: string;
  requested_by: number;
  requested_by_name: string;
  status: PartRequestStatus;
  note: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PartRequestItemRow extends RowDataPacket {
  id: number;
  part_request_id: number;
  part_id: number;
  part_sku: string;
  part_name: string;
  part_unit: string;
  selling_price: number;
  quantity_on_hand: number;
  part_is_active: number | boolean;
  requested_quantity: number;
  fulfilled_quantity: number;
  created_at: Date;
}

export interface PartRequestItem {
  id: number;
  part: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    sellingPrice: number;
    quantityOnHand: number;
    isActive: boolean;
  };
  requestedQuantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  createdAt: Date;
}

export interface PartRequest {
  id: number;
  ticket: { id: number; ticketCode: string };
  requestedBy: { id: number; fullName: string };
  status: PartRequestStatus;
  note: string | null;
  approvedBy: { id: number; fullName: string } | null;
  approvedAt: Date | null;
  items: PartRequestItem[];
  createdAt: Date;
  updatedAt: Date;
}

export function toPartRequestItem(row: PartRequestItemRow): PartRequestItem {
  return {
    id: row.id,
    part: {
      id: row.part_id,
      sku: row.part_sku,
      name: row.part_name,
      unit: row.part_unit,
      sellingPrice: row.selling_price,
      quantityOnHand: row.quantity_on_hand,
      isActive: Boolean(row.part_is_active),
    },
    requestedQuantity: row.requested_quantity,
    fulfilledQuantity: row.fulfilled_quantity,
    remainingQuantity: row.requested_quantity - row.fulfilled_quantity,
    createdAt: row.created_at,
  };
}

export function toPartRequest(
  row: PartRequestRow,
  itemRows: PartRequestItemRow[],
): PartRequest {
  return {
    id: row.id,
    ticket: { id: row.ticket_id, ticketCode: row.ticket_code },
    requestedBy: { id: row.requested_by, fullName: row.requested_by_name },
    status: row.status,
    note: row.note,
    approvedBy: row.approved_by && row.approved_by_name
      ? { id: row.approved_by, fullName: row.approved_by_name }
      : null,
    approvedAt: row.approved_at,
    items: itemRows.map(toPartRequestItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

