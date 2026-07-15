import type { TestResultValue } from "./repair-action.model.js";

export interface RepairLogPartDto {
  partId: number;
  quantity: number;
}

export interface CreateRepairLogDto {
  actionDescription: string;
  result?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  parts: RepairLogPartDto[];
}

export interface UpdateRepairLogDto {
  actionDescription?: string;
  result?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  parts?: RepairLogPartDto[];
}

export interface CreateTestResultDto {
  testName: string;
  result: TestResultValue;
  note?: string | null;
}

export interface CompleteTestingDto {
  reason?: string;
}
