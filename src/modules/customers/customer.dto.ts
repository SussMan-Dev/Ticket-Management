import type { UserAccountStatus } from "../users/user.model.js";
import type { CustomerSummary } from "./customer.model.js";

export type CustomerSortField = "createdAt" | "fullName" | "email" | "status";
export type CustomerSortOrder = "asc" | "desc";

export interface ListCustomersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: UserAccountStatus;
  sortBy: CustomerSortField;
  sortOrder: CustomerSortOrder;
}

export interface CreateCustomerDto {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDto {
  fullName?: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface ListCustomersResult {
  customers: CustomerSummary[];
  total: number;
}
