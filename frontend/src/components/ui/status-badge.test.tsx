import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("hiển thị trạng thái thanh toán bằng tiếng Việt", () => {
    render(<StatusBadge value="PARTIALLY_PAID" />);

    expect(screen.getByText("Đã thanh toán một phần")).toBeInTheDocument();
  });
});
