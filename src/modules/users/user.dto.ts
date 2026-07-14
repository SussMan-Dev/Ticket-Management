import type { UserRole } from "../../common/constants/roles.js";
import type {
  SafeUser,
  StaffRole,
  UserAccountStatus,
} from "./user.model.js";

export type UserSortField = "createdAt" | "fullName" | "email" | "status" | "role";
export type SortOrder = "asc" | "desc";

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  status?: UserAccountStatus;
  sortBy: UserSortField;
  sortOrder: SortOrder;
}

export interface CreateStaffDto {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: StaffRole;
}

export interface UpdateUserDto {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface ListUsersResult {
  users: SafeUser[];
  total: number;
}
