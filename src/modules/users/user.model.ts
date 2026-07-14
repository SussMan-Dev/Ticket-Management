import type { RowDataPacket } from "mysql2";
import type { UserRole } from "../../common/constants/roles.js";

export const USER_ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export const STAFF_ROLES = [
  "RECEPTIONIST",
  "TECHNICIAN",
  "MANAGER",
  "ADMIN",
  "INVENTORY_STAFF",
  "CASHIER",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface UserRow extends RowDataPacket {
  id: number;
  role_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  status: UserAccountStatus;
  avatar_url: string | null;
  role: UserRole;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserAccountStatus;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleRow extends RowDataPacket {
  id: number;
  code: UserRole;
}

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatar_url,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
