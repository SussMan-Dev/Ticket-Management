import type { RowDataPacket } from "mysql2";
import type { UserRole } from "../../common/constants/roles.js";
import type { UserAccountStatus } from "../users/user.model.js";

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: number;
  sessionId: string;
  type: "refresh";
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

export interface AuthenticationUserRow extends RowDataPacket {
  id: number;
  role_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  status: UserAccountStatus;
  avatar_url: string | null;
  role: UserRole;
  last_login_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AuthenticationContextRow extends RowDataPacket {
  session_id: string;
  session_expires_at: Date;
  session_revoked_at: Date | null;
  user_id: number;
  email: string;
  role: UserRole;
  user_status: UserAccountStatus;
  user_deleted_at: Date | null;
  user_locked_until: Date | null;
}

export interface RefreshSessionRow extends AuthenticationContextRow {
  refresh_token_hash: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
