import type { PartRequest, PartRequestStatus } from "./inventory.model.js";

export interface PartRequestItemDto {
  partId: number;
  requestedQuantity: number;
}

export interface CreatePartRequestDto {
  note?: string | null;
  items: PartRequestItemDto[];
}

export interface ListPartRequestsQuery {
  page: number;
  limit: number;
  status?: PartRequestStatus;
  ticketId?: number;
  requestedBy?: number;
}

export interface FulfillPartRequestDto {
  items: Array<{ partId: number; quantity: number }>;
  note?: string | null;
}

export interface ListPartRequestsResult {
  requests: PartRequest[];
  total: number;
}

