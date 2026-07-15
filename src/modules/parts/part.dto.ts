import type {
  InventoryTransaction,
  InventoryTransactionType,
  Part,
  TechnicianPart,
} from "./part.model.js";

export type PartSortField =
  | "createdAt"
  | "sku"
  | "name"
  | "quantityOnHand"
  | "sellingPrice";

export interface ListPartsQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  lowStock?: boolean;
  sortBy: PartSortField;
  sortOrder: "asc" | "desc";
}

export interface CreatePartDto {
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  isActive: boolean;
}

export type UpdatePartDto = Partial<CreatePartDto>;

export interface StockInDto {
  quantity: number;
  note: string;
}

export interface AdjustStockDto {
  quantityChange: number;
  note: string;
}

export interface ListInventoryTransactionsQuery {
  page: number;
  limit: number;
  transactionType?: InventoryTransactionType;
}

export interface ListPartsResult {
  parts: Array<Part | TechnicianPart>;
  total: number;
}

export interface ListInventoryTransactionsResult {
  transactions: InventoryTransaction[];
  total: number;
}
