import type { RowDataPacket } from "mysql2";
import type { UserRole } from "../../common/constants/roles.js";

export const TEST_RESULT_VALUES = ["PASS", "FAIL"] as const;
export type TestResultValue = (typeof TEST_RESULT_VALUES)[number];

export const TIMELINE_EVENT_TYPES = [
  "TICKET_STATUS",
  "ASSIGNMENT",
  "DIAGNOSIS",
  "QUOTATION",
  "PART_REQUEST",
  "INVENTORY_MOVEMENT",
  "REPAIR_LOG",
  "TEST_RESULT",
  "INVOICE",
  "PAYMENT",
  "DELIVERY",
  "REVIEW",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export interface RepairLogRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  technician_id: number;
  technician_name: string;
  action_description: string;
  result: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RepairLogPartRow extends RowDataPacket {
  id: number;
  repair_log_id: number;
  part_id: number;
  part_sku: string;
  part_name: string;
  part_unit: string;
  quantity: number;
  created_at: Date;
}

export interface PartUsageTotalRow extends RowDataPacket {
  part_id: number;
  quantity: number;
}

export interface TestResultRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  tested_by: number;
  tested_by_name: string;
  test_name: string;
  result: TestResultValue;
  note: string | null;
  tested_at: Date;
}

export interface TimelineEventRow extends RowDataPacket {
  event_key: string;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  actor_id: number | null;
  actor_name: string | null;
  actor_role: UserRole | null;
  occurred_at: Date;
}

export interface RepairLogPart {
  id: number;
  part: { id: number; sku: string; name: string; unit: string };
  quantity: number;
  createdAt: Date;
}

export interface RepairLog {
  id: number;
  ticketId: number;
  technician: { id: number; fullName: string };
  actionDescription: string;
  result: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  parts: RepairLogPart[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerRepairLog {
  id: number;
  ticketId: number;
  actionDescription: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResult {
  id: number;
  ticketId: number;
  testedBy: { id: number; fullName: string };
  testName: string;
  result: TestResultValue;
  note: string | null;
  testedAt: Date;
}

export interface CustomerTestResult {
  id: number;
  ticketId: number;
  testName: string;
  result: TestResultValue;
  testedAt: Date;
}

export interface TimelineEvent {
  key: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  actor: { id: number; fullName: string; role: UserRole } | null;
  occurredAt: Date;
}

export interface TestingCompletionResult {
  outcome: "COMPLETED" | "REPAIR_REQUIRED";
  ticketStatus: "COMPLETED" | "REPAIRING";
}

export function toRepairLogPart(row: RepairLogPartRow): RepairLogPart {
  return {
    id: row.id,
    part: {
      id: row.part_id,
      sku: row.part_sku,
      name: row.part_name,
      unit: row.part_unit,
    },
    quantity: row.quantity,
    createdAt: row.created_at,
  };
}

export function toRepairLog(
  row: RepairLogRow,
  partRows: RepairLogPartRow[],
): RepairLog {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    technician: { id: row.technician_id, fullName: row.technician_name },
    actionDescription: row.action_description,
    result: row.result,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    parts: partRows.map(toRepairLogPart),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCustomerRepairLog(log: RepairLog): CustomerRepairLog {
  return {
    id: log.id,
    ticketId: log.ticketId,
    actionDescription: log.actionDescription,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

export function toTestResult(row: TestResultRow): TestResult {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    testedBy: { id: row.tested_by, fullName: row.tested_by_name },
    testName: row.test_name,
    result: row.result,
    note: row.note,
    testedAt: row.tested_at,
  };
}

export function toCustomerTestResult(result: TestResult): CustomerTestResult {
  return {
    id: result.id,
    ticketId: result.ticketId,
    testName: result.testName,
    result: result.result,
    testedAt: result.testedAt,
  };
}

export function toTimelineEvent(
  row: TimelineEventRow,
  customerSafe = false,
): TimelineEvent {
  const hideDetails = customerSafe && [
    "ASSIGNMENT",
    "DIAGNOSIS",
    "PART_REQUEST",
    "INVENTORY_MOVEMENT",
    "REPAIR_LOG",
  ].includes(row.event_type);

  return {
    key: row.event_key,
    type: row.event_type,
    title: row.title,
    description: hideDetails ? null : row.description,
    actor: customerSafe || !row.actor_id || !row.actor_name || !row.actor_role
      ? null
      : {
          id: row.actor_id,
          fullName: row.actor_name,
          role: row.actor_role,
        },
    occurredAt: row.occurred_at,
  };
}
