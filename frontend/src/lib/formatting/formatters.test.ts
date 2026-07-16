import { describe, expect, it } from "vitest";
import { formatMoney } from "./formatters";

describe("formatMoney", () => {
  it("hiển thị số tiền với hậu tố VNĐ", () => {
    expect(formatMoney(1_234_567)).toBe("1.234.567 VNĐ");
    expect(formatMoney(1_234.5)).toBe("1.234,5 VNĐ");
  });
});
