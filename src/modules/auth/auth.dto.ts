import type { SafeUser } from "../users/user.model.js";

export interface RegisterCustomerDto {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  address?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthResponseData {
  user: SafeUser;
  accessToken: string;
  accessTokenExpiresAt: Date;
}

export interface IssuedAuthentication {
  data: AuthResponseData;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
