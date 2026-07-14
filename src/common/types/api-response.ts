export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T, TMeta = null> {
  success: true;
  message: string;
  data: T;
  meta: TMeta;
}

export interface ApiErrorBody {
  code: string;
  details: unknown;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: ApiErrorBody;
}
