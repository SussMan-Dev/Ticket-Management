import type { PaginationMeta } from "../types/api-response.js";
import type { PaginationResult } from "../types/pagination.js";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function normalizePagination(
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_LIMIT,
): PaginationResult {
  const normalizedPage = Math.max(DEFAULT_PAGE, Math.trunc(page));
  const normalizedLimit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, Math.trunc(limit)),
  );

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: (normalizedPage - 1) * normalizedLimit,
  };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
