export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationResult extends PaginationInput {
  offset: number;
}
