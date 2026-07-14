import type { Device } from "./device.model.js";

export type DeviceSortField = "createdAt" | "updatedAt" | "model";
export type DeviceSortOrder = "asc" | "desc";

export interface ListDevicesQuery {
  page: number;
  limit: number;
  search?: string;
  customerId?: number;
  sortBy: DeviceSortField;
  sortOrder: DeviceSortOrder;
}

export interface CreateDeviceDto {
  customerId?: number;
  categoryId: number;
  brandId?: number | null;
  model?: string | null;
  serialNumber?: string | null;
  imei?: string | null;
  color?: string | null;
  description?: string | null;
}

export interface UpdateDeviceDto {
  categoryId?: number;
  brandId?: number | null;
  model?: string | null;
  serialNumber?: string | null;
  imei?: string | null;
  color?: string | null;
  description?: string | null;
}

export interface ListDevicesResult {
  devices: Device[];
  total: number;
}
