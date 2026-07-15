export const USER_ROLES = [
  "CUSTOMER",
  "RECEPTIONIST",
  "TECHNICIAN",
  "MANAGER",
  "ADMIN",
  "INVENTORY_STAFF",
  "CASHIER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserAccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export type StaffRole = Exclude<UserRole, "CUSTOMER">;

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserAccountStatus;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserAccountStatus;
  createdAt: string;
}

export interface CustomerProfile extends CustomerSummary {
  avatarUrl: string | null;
  address: string | null;
  updatedAt: string;
  notes?: string | null;
}

export interface CatalogItem {
  id: number;
  name: string;
  description?: string | null;
}

export interface Device {
  id: number;
  customer: { id: number; fullName: string };
  category: CatalogItem;
  brand: Omit<CatalogItem, "description"> | null;
  model: string | null;
  serialNumber: string | null;
  imei: string | null;
  color: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TICKET_STATUSES = [
  "NEW",
  "RECEIVED",
  "ASSIGNED",
  "DIAGNOSING",
  "WAITING_FOR_QUOTATION",
  "WAITING_FOR_CUSTOMER_APPROVAL",
  "CUSTOMER_REJECTED",
  "WAITING_FOR_PARTS",
  "REPAIRING",
  "TESTING",
  "COMPLETED",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CLOSED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TicketAttachmentType =
  | "BEFORE_REPAIR"
  | "DURING_REPAIR"
  | "AFTER_REPAIR"
  | "CUSTOMER_ATTACHMENT"
  | "DELIVERY_PROOF";

export interface RepairTicket {
  id: number;
  ticketCode: string;
  customer: { id: number; fullName: string };
  device: {
    id: number;
    model: string | null;
    serialNumber: string | null;
    category: string;
    brand: string | null;
  };
  createdBy: { id: number; fullName: string };
  title: string;
  customerIssue: string;
  initialCondition: string | null;
  accessoriesReceived: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  expectedDiagnosisAt: string | null;
  expectedCompletionAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStatusHistory {
  id: number;
  ticketId: number;
  changedBy: { id: number; fullName: string; role: UserRole };
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  reason: string | null;
  createdAt: string;
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  uploadedBy: { id: number; fullName: string; role: UserRole };
  attachmentType: TicketAttachmentType;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  createdAt: string;
}

export interface TicketAssignment {
  id: number;
  ticketId: number;
  technician: { id: number; fullName: string; email: string };
  assignedBy: { id: number; fullName: string };
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
  note: string | null;
}

export type DiagnosisStatus = "DRAFT" | "SUBMITTED" | "REVISION_REQUIRED" | "APPROVED";

export interface DiagnosisPart {
  id: number;
  partId: number;
  sku: string;
  name: string;
  quantity: number;
  note?: string | null;
  createdAt: string;
}

export interface Diagnosis {
  id: number;
  ticketId: number;
  technician?: { id: number; fullName: string };
  actualIssue: string;
  rootCause?: string | null;
  proposedSolution: string;
  laborCost: number;
  estimatedHours: number | null;
  dataLossRisk: boolean;
  riskNote?: string | null;
  status: DiagnosisStatus;
  submittedAt?: string | null;
  approvedBy?: { id: number; fullName: string } | null;
  approvedAt: string | null;
  parts: DiagnosisPart[];
  createdAt: string;
  updatedAt: string;
}

export const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface QuotationItem {
  id: number;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Quotation {
  id: number;
  ticketId: number;
  version: number;
  status: QuotationStatus;
  items: QuotationItem[];
  laborAmount: number;
  partsAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  expiresAt: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  source: "mock" | "api";
}
