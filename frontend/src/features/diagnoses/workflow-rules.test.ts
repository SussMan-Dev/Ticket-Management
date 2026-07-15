import { describe, expect, it } from "vitest";
import { ticketActionFlags } from "../repair-tickets/ticket-action.rules";
import { canEditDiagnosis, canReviewDiagnosis, canSubmitDiagnosis } from "./diagnosis.rules";

describe("assignment và diagnosis workflow rules", () => {
  it("technician chỉ sửa/gửi DRAFT hoặc REVISION_REQUIRED", () => {
    expect(canEditDiagnosis("TECHNICIAN", "DRAFT")).toBe(true);
    expect(canEditDiagnosis("TECHNICIAN", "REVISION_REQUIRED")).toBe(true);
    expect(canEditDiagnosis("TECHNICIAN", "SUBMITTED")).toBe(false);
    expect(canSubmitDiagnosis("MANAGER", "DRAFT")).toBe(false);
  });

  it("manager chỉ review SUBMITTED", () => {
    expect(canReviewDiagnosis("MANAGER", "SUBMITTED")).toBe(true);
    expect(canReviewDiagnosis("MANAGER", "APPROVED")).toBe(false);
    expect(canReviewDiagnosis("TECHNICIAN", "SUBMITTED")).toBe(false);
  });

  it("manager assign ở RECEIVED và chỉ reassign ở ASSIGNED", () => {
    expect(ticketActionFlags("MANAGER", "RECEIVED")).toMatchObject({ canAssign: true, canReassign: false });
    expect(ticketActionFlags("MANAGER", "ASSIGNED")).toMatchObject({ canAssign: false, canReassign: true });
    expect(ticketActionFlags("TECHNICIAN", "RECEIVED")).toMatchObject({ canAssign: false, canReassign: false });
  });
});
