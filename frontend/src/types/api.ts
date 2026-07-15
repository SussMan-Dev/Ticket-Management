export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T, TMeta = null> {
  success: true;
  message: string;
  data: T;
  meta: TMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  error: { code: string; details: unknown };
}

export interface AuthPayload {
  user: import("./domain").SafeUser;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
