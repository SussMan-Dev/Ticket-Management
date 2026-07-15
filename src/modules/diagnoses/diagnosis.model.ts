import type { RowDataPacket } from "mysql2";

export const DIAGNOSIS_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "REVISION_REQUIRED",
  "APPROVED",
] as const;

export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];

export interface DiagnosisRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  technician_id: number;
  technician_name: string;
  actual_issue: string;
  root_cause: string | null;
  proposed_solution: string;
  labor_cost: number;
  estimated_hours: number | null;
  data_loss_risk: number | boolean;
  risk_note: string | null;
  status: DiagnosisStatus;
  submitted_at: Date | null;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DiagnosisPartRow extends RowDataPacket {
  id: number;
  diagnosis_id: number;
  part_id: number;
  sku: string;
  part_name: string;
  quantity: number;
  note: string | null;
  created_at: Date;
}

export interface PartReferenceRow extends RowDataPacket {
  id: number;
}

export interface DiagnosisPart {
  id: number;
  partId: number;
  sku: string;
  name: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
}

export interface Diagnosis {
  id: number;
  ticketId: number;
  technician: {
    id: number;
    fullName: string;
  };
  actualIssue: string;
  rootCause: string | null;
  proposedSolution: string;
  laborCost: number;
  estimatedHours: number | null;
  dataLossRisk: boolean;
  riskNote: string | null;
  status: DiagnosisStatus;
  submittedAt: Date | null;
  approvedBy: {
    id: number;
    fullName: string;
  } | null;
  approvedAt: Date | null;
  parts: DiagnosisPart[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerDiagnosis {
  id: number;
  ticketId: number;
  actualIssue: string;
  proposedSolution: string;
  laborCost: number;
  estimatedHours: number | null;
  dataLossRisk: boolean;
  status: "APPROVED";
  approvedAt: Date;
  parts: Array<Omit<DiagnosisPart, "note">>;
  createdAt: Date;
  updatedAt: Date;
}

export function toDiagnosisPart(row: DiagnosisPartRow): DiagnosisPart {
  return {
    id: row.id,
    partId: row.part_id,
    sku: row.sku,
    name: row.part_name,
    quantity: row.quantity,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toDiagnosis(
  row: DiagnosisRow,
  partRows: DiagnosisPartRow[],
): Diagnosis {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    technician: {
      id: row.technician_id,
      fullName: row.technician_name,
    },
    actualIssue: row.actual_issue,
    rootCause: row.root_cause,
    proposedSolution: row.proposed_solution,
    laborCost: row.labor_cost,
    estimatedHours: row.estimated_hours,
    dataLossRisk: Boolean(row.data_loss_risk),
    riskNote: row.risk_note,
    status: row.status,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by && row.approved_by_name
      ? { id: row.approved_by, fullName: row.approved_by_name }
      : null,
    approvedAt: row.approved_at,
    parts: partRows.map(toDiagnosisPart),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCustomerDiagnosis(diagnosis: Diagnosis): CustomerDiagnosis {
  if (diagnosis.status !== "APPROVED" || !diagnosis.approvedAt) {
    throw new Error("Only approved diagnoses can be serialized for customers");
  }

  return {
    id: diagnosis.id,
    ticketId: diagnosis.ticketId,
    actualIssue: diagnosis.actualIssue,
    proposedSolution: diagnosis.proposedSolution,
    laborCost: diagnosis.laborCost,
    estimatedHours: diagnosis.estimatedHours,
    dataLossRisk: diagnosis.dataLossRisk,
    status: diagnosis.status,
    approvedAt: diagnosis.approvedAt,
    parts: diagnosis.parts.map(({ note: _note, ...part }) => part),
    createdAt: diagnosis.createdAt,
    updatedAt: diagnosis.updatedAt,
  };
}
