import { describe, expect, it } from "vitest";
import {
  createPaginationMeta,
  MAX_PAGE_LIMIT,
  normalizePagination,
} from "../src/common/utils/pagination.util.js";

describe("pagination utilities", () => {
  it("normalizes invalid lower bounds and caps the page size", () => {
    expect(normalizePagination(0, 1_000)).toEqual({
      page: 1,
      limit: MAX_PAGE_LIMIT,
      offset: 0,
    });
  });

  it("builds pagination metadata", () => {
    expect(createPaginationMeta(2, 20, 41)).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });
});
