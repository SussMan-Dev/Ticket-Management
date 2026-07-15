export interface DiagnosisPartDto {
  partId: number;
  quantity: number;
  note?: string | null;
}

export interface CreateDiagnosisDto {
  actualIssue: string;
  rootCause?: string | null;
  proposedSolution: string;
  laborCost: number;
  estimatedHours?: number | null;
  dataLossRisk: boolean;
  riskNote?: string | null;
  parts: DiagnosisPartDto[];
}

export interface UpdateDiagnosisDto {
  actualIssue?: string;
  rootCause?: string | null;
  proposedSolution?: string;
  laborCost?: number;
  estimatedHours?: number | null;
  dataLossRisk?: boolean;
  riskNote?: string | null;
  parts?: DiagnosisPartDto[];
}
