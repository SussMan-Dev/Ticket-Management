import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagnosis } from "../../types/domain";
import { DiagnosisRecord } from "./diagnosis-panel";

vi.mock("./diagnoses.api", () => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  });
  return {
    useSubmitDiagnosis: mutation,
    useApproveDiagnosis: mutation,
    useRequestDiagnosisRevision: mutation,
    useCreateDiagnosis: mutation,
    useUpdateDiagnosis: mutation,
  };
});

vi.mock("../parts/parts.api", () => ({
  useParts: () => ({ data: { data: [] }, isLoading: false, error: null }),
}));

function diagnosis(status: Diagnosis["status"]): Diagnosis {
  return {
    id: 20,
    ticketId: 10,
    technician: { id: 6, fullName: "Technician" },
    actualIssue: "Screen does not turn on",
    rootCause: "Display assembly failure",
    proposedSolution: "Replace display assembly",
    laborCost: 200_000,
    estimatedHours: 2,
    dataLossRisk: false,
    riskNote: null,
    status,
    submittedAt: status === "SUBMITTED" ? "2026-07-15T00:00:00.000Z" : null,
    approvedBy: null,
    approvedAt: null,
    parts: [],
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
}

describe("DiagnosisRecord actions", () => {
  it("renders submit beside the editable technician draft", () => {
    render(<DiagnosisRecord diagnosis={diagnosis("DRAFT")} role="TECHNICIAN" />);

    expect(screen.getByRole("button", { name: "Gửi duyệt chẩn đoán" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu chẩn đoán" })).toBeInTheDocument();
  });

  it("renders manager approval after the technician submits", () => {
    render(<DiagnosisRecord diagnosis={diagnosis("SUBMITTED")} role="MANAGER" />);

    expect(screen.getByRole("button", { name: "Duyệt chẩn đoán" })).toBeInTheDocument();
  });
});
