import type { RowDataPacket } from "mysql2";
import type { UserAccountStatus } from "../users/user.model.js";

export interface CustomerRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  status: UserAccountStatus;
  avatar_url: string | null;
  address: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSummary {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserAccountStatus;
  createdAt: Date;
}

export interface CustomerProfile extends CustomerSummary {
  avatarUrl: string | null;
  address: string | null;
  updatedAt: Date;
  notes?: string | null;
}

export function toCustomerSummary(row: CustomerRow): CustomerSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toCustomerProfile(
  row: CustomerRow,
  includeStaffNotes: boolean,
): CustomerProfile {
  const profile: CustomerProfile = {
    ...toCustomerSummary(row),
    avatarUrl: row.avatar_url,
    address: row.address,
    updatedAt: row.updated_at,
  };

  if (includeStaffNotes) {
    profile.notes = row.notes;
  }

  return profile;
}
