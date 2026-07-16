import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InvoiceCostBreakdown as InvoiceCostBreakdownData } from "../../types/domain";
import { InvoiceCostBreakdown } from "./invoice-cost-breakdown";

const breakdown: InvoiceCostBreakdownData = {
  lines: [
    {
      type: "LABOR",
      description: "Công thay màn hình",
      part: null,
      quantity: 1,
      unitPrice: 400_000,
      lineTotal: 400_000,
      source: "ACCEPTED_QUOTATION",
    },
    {
      type: "PART",
      description: "Màn hình OLED",
      part: { id: 4, sku: "SCR-01", name: "Màn hình OLED", unit: "cái" },
      quantity: 1,
      unitPrice: 600_000,
      lineTotal: 600_000,
      source: "FULFILLED_PART_REQUEST",
    },
  ],
  serviceSubtotal: 400_000,
  partSubtotal: 600_000,
  subtotal: 1_000_000,
  discountAmount: 100_000,
  taxAmount: 50_000,
  totalAmount: 950_000,
};

describe("InvoiceCostBreakdown", () => {
  it("shows item sources and the complete amount calculation", () => {
    render(<InvoiceCostBreakdown breakdown={breakdown} />);

    expect(screen.getByText("Công thay màn hình")).toBeInTheDocument();
    expect(screen.getByText("Màn hình OLED")).toBeInTheDocument();
    expect(screen.getByText("SCR-01 · Theo số lượng kho đã cấp")).toBeInTheDocument();
    const total = screen.getByText("Tổng thanh toán").closest("div");
    expect(total).not.toBeNull();
    expect(within(total as HTMLElement).getByText(/950\.000/)).toBeInTheDocument();
  });
});
