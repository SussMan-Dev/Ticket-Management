import type { DiagnosisStatus, UserRole } from "../../types/domain";

export function canEditDiagnosis(role: UserRole, status: DiagnosisStatus): boolean {
  return role === "TECHNICIAN" && (status === "DRAFT" || status === "REVISION_REQUIRED");
}

export function canSubmitDiagnosis(role: UserRole, status: DiagnosisStatus): boolean {
  return role === "TECHNICIAN" && (status === "DRAFT" || status === "REVISION_REQUIRED");
}

export function canReviewDiagnosis(role: UserRole, status: DiagnosisStatus): boolean {
  return role === "MANAGER" && status === "SUBMITTED";
}
