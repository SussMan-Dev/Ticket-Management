import type { RowDataPacket } from "mysql2";
import type { UserRole } from "../../common/constants/roles.js";
import type { TicketStatus } from "../../common/constants/ticket-status.js";
import type { UserAccountStatus } from "../users/user.model.js";

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_ATTACHMENT_TYPES = [
  "BEFORE_REPAIR",
  "DURING_REPAIR",
  "AFTER_REPAIR",
  "CUSTOMER_ATTACHMENT",
  "DELIVERY_PROOF",
] as const;
export type TicketAttachmentType = (typeof TICKET_ATTACHMENT_TYPES)[number];

export interface RepairTicketRow extends RowDataPacket {
  id: number;
  ticket_code: string;
  customer_id: number;
  customer_name: string;
  device_id: number;
  device_model: string | null;
  device_serial_number: string | null;
  device_category: string;
  device_brand: string | null;
  created_by: number;
  creator_name: string;
  title: string;
  customer_issue: string;
  initial_condition: string | null;
  accessories_received: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  expected_diagnosis_at: Date | null;
  expected_completion_at: Date | null;
  received_at: Date | null;
  completed_at: Date | null;
  delivered_at: Date | null;
  closed_at: Date | null;
  cancellation_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TicketDeviceReferenceRow extends RowDataPacket {
  id: number;
  customer_id: number;
}

export interface TicketCustomerReferenceRow extends RowDataPacket {
  id: number;
  status: UserAccountStatus;
}

export interface TicketStatusHistoryRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  changed_by: number;
  changed_by_name: string;
  changed_by_role: UserRole;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  reason: string | null;
  created_at: Date;
}

export interface TicketAttachmentRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_by_role: UserRole;
  attachment_type: TicketAttachmentType;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: Date;
}

export interface RepairTicket {
  id: number;
  ticketCode: string;
  customer: {
    id: number;
    fullName: string;
  };
  device: {
    id: number;
    model: string | null;
    serialNumber: string | null;
    category: string;
    brand: string | null;
  };
  createdBy: {
    id: number;
    fullName: string;
  };
  title: string;
  customerIssue: string;
  initialCondition: string | null;
  accessoriesReceived: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  expectedDiagnosisAt: Date | null;
  expectedCompletionAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketStatusHistory {
  id: number;
  ticketId: number;
  changedBy: {
    id: number;
    fullName: string;
    role: UserRole;
  };
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  reason: string | null;
  createdAt: Date;
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  uploadedBy: {
    id: number;
    fullName: string;
    role: UserRole;
  };
  attachmentType: TicketAttachmentType;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  createdAt: Date;
}

export function toRepairTicket(row: RepairTicketRow): RepairTicket {
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
    },
    device: {
      id: row.device_id,
      model: row.device_model,
      serialNumber: row.device_serial_number,
      category: row.device_category,
      brand: row.device_brand,
    },
    createdBy: {
      id: row.created_by,
      fullName: row.creator_name,
    },
    title: row.title,
    customerIssue: row.customer_issue,
    initialCondition: row.initial_condition,
    accessoriesReceived: row.accessories_received,
    status: row.status,
    priority: row.priority,
    expectedDiagnosisAt: row.expected_diagnosis_at,
    expectedCompletionAt: row.expected_completion_at,
    receivedAt: row.received_at,
    completedAt: row.completed_at,
    deliveredAt: row.delivered_at,
    closedAt: row.closed_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTicketStatusHistory(
  row: TicketStatusHistoryRow,
): TicketStatusHistory {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    changedBy: {
      id: row.changed_by,
      fullName: row.changed_by_name,
      role: row.changed_by_role,
    },
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function toTicketAttachment(row: TicketAttachmentRow): TicketAttachment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    uploadedBy: {
      id: row.uploaded_by,
      fullName: row.uploaded_by_name,
      role: row.uploaded_by_role,
    },
    attachmentType: row.attachment_type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}
