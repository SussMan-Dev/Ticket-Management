import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diagnosisSchema } from "../../features/diagnoses/diagnosis.schemas";
import { ApiError } from "../../lib/api/api-error";
import { MutationError } from "./data-state";

describe("409/422 và field validation", () => {
  it("hướng dẫn reload khi stale-state conflict 409", () => {
    render(<MutationError error={new ApiError("Conflict", 409, "CONFLICT")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("tải lại");
  });

  it("hiển thị thông báo kiểm tra field cho 422", () => {
    render(<MutationError error={new ApiError("Validation", 422, "VALIDATION_ERROR", { fields: [] })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("chưa hợp lệ");
  });

  it("chặn part trùng và quantity không dương trước khi gọi API", () => {
    const result = diagnosisSchema.safeParse({ actualIssue: "Lỗi nguồn", proposedSolution: "Thay nguồn", laborCost: 0, dataLossRisk: false, parts: [{ partId: 2, quantity: 1 }, { partId: 2, quantity: 0 }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining(["Linh kiện không được trùng"]));
  });
});
