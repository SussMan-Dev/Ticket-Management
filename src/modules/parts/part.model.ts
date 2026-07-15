import type { RowDataPacket } from "mysql2";

export const INVENTORY_TRANSACTION_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN",
] as const;

export type InventoryTransactionType =
  (typeof INVENTORY_TRANSACTION_TYPES)[number];

export interface PartRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  quantity_on_hand: number;
  minimum_stock: number;
  is_active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryTransactionRow extends RowDataPacket {
  id: number;
  part_id: number;
  part_sku: string;
  part_name: string;
  ticket_id: number | null;
  ticket_code: string | null;
  transaction_type: InventoryTransactionType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  performed_by: number;
  performed_by_name: string;
  note: string | null;
  created_at: Date;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  quantityOnHand: number;
  minimumStock: number;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TechnicianPart = Omit<Part, "purchasePrice">;

export interface InventoryTransaction {
  id: number;
  part: { id: number; sku: string; name: string };
  ticket: { id: number; ticketCode: string } | null;
  transactionType: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: number | null;
  performedBy: { id: number; fullName: string };
  note: string | null;
  createdAt: Date;
}

export function toPart(row: PartRow): Part {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    unit: row.unit,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    quantityOnHand: row.quantity_on_hand,
    minimumStock: row.minimum_stock,
    isLowStock: row.quantity_on_hand <= row.minimum_stock,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTechnicianPart(part: Part): TechnicianPart {
  const { purchasePrice: _purchasePrice, ...safe } = part;
  return safe;
}

export function toInventoryTransaction(
  row: InventoryTransactionRow,
): InventoryTransaction {
  return {
    id: row.id,
    part: { id: row.part_id, sku: row.part_sku, name: row.part_name },
    ticket: row.ticket_id && row.ticket_code
      ? { id: row.ticket_id, ticketCode: row.ticket_code }
      : null,
    transactionType: row.transaction_type,
    quantity: row.quantity,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    performedBy: { id: row.performed_by, fullName: row.performed_by_name },
    note: row.note,
    createdAt: row.created_at,
  };
}

