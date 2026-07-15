import type { TicketStatus } from "../../common/constants/ticket-status.js";
import type {
  RepairTicket,
  TicketAttachmentType,
  TicketPriority,
} from "./repair-ticket.model.js";

export type TicketSortField = "createdAt" | "updatedAt" | "priority" | "status";
export type TicketSortOrder = "asc" | "desc";

export interface ListRepairTicketsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  customerId?: number;
  deviceId?: number;
  assignedTechnicianId?: number;
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
}

export interface CreateRepairTicketDto {
  customerId?: number;
  deviceId: number;
  title: string;
  customerIssue: string;
  repairAddress: string;
  initialCondition?: string | null;
  accessoriesReceived?: string | null;
  priority: TicketPriority;
  expectedDiagnosisAt?: Date | null;
  expectedCompletionAt?: Date | null;
  receiveNow: boolean;
}

export interface UpdateRepairTicketDto {
  title?: string;
  customerIssue?: string;
  repairAddress?: string;
  initialCondition?: string | null;
  accessoriesReceived?: string | null;
  priority?: TicketPriority;
  expectedDiagnosisAt?: Date | null;
  expectedCompletionAt?: Date | null;
}

export interface CreateTicketAttachmentDto {
  attachmentType: TicketAttachmentType;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface ListRepairTicketsResult {
  tickets: RepairTicket[];
  total: number;
}
