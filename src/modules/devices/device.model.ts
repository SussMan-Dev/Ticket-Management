import type { RowDataPacket } from "mysql2";
import type { UserAccountStatus } from "../users/user.model.js";

export interface CatalogRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string | null;
  is_active: number | boolean;
}

export interface DeviceCustomerRow extends RowDataPacket {
  id: number;
  status: UserAccountStatus;
}

export interface DeviceRow extends RowDataPacket {
  id: number;
  customer_id: number;
  customer_name: string;
  category_id: number;
  category_name: string;
  brand_id: number | null;
  brand_name: string | null;
  model: string | null;
  serial_number: string | null;
  imei: string | null;
  color: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CatalogItem {
  id: number;
  name: string;
  description?: string | null;
}

export interface Device {
  id: number;
  customer: {
    id: number;
    fullName: string;
  };
  category: CatalogItem;
  brand: Omit<CatalogItem, "description"> | null;
  model: string | null;
  serialNumber: string | null;
  imei: string | null;
  color: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toCatalogItem(row: CatalogRow): CatalogItem {
  const item: CatalogItem = {
    id: row.id,
    name: row.name,
  };

  if (row.description !== undefined) {
    item.description = row.description;
  }

  return item;
}

export function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
    },
    category: {
      id: row.category_id,
      name: row.category_name,
    },
    brand: row.brand_id === null
      ? null
      : {
          id: row.brand_id,
          name: row.brand_name ?? "",
        },
    model: row.model,
    serialNumber: row.serial_number,
    imei: row.imei,
    color: row.color,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
