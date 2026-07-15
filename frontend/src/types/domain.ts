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
  repairAddress: string | null;
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

export interface AssignableTechnician {
  id: number;
  fullName: string;
  email: string;
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
  itemType: "LABOR" | "PART" | "OTHER";
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface Quotation {
  id: number;
  ticketId: number;
  diagnosisId: number;
  version: number;
  status: QuotationStatus;
  items: QuotationItem[];
  laborAmount: number;
  partsAmount: number;
  otherAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  expiresAt: string | null;
  createdBy: { id: number; fullName: string };
  approvedBy: { id: number; fullName: string } | null;
  approvedAt: string | null;
  sentAt: string | null;
  customerRespondedAt: string | null;
  customerResponseNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransactionType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN";

export interface Part {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  purchasePrice?: number;
  sellingPrice: number;
  quantityOnHand: number;
  minimumStock: number;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: number;
  part: { id: number; sku: string; name: string };
  ticket: { id: number; ticketCode: string } | null;
  transactionType: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: number | null;
  performedBy: { id: number; fullName: string };
  note: string | null;
  createdAt: string;
}

export type PartRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "REJECTED"
  | "CANCELLED";

export interface PartRequestItem {
  id: number;
  part: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    sellingPrice: number;
    quantityOnHand: number;
    isActive: boolean;
  };
  requestedQuantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  createdAt: string;
}

export interface PartRequest {
  id: number;
  ticket: { id: number; ticketCode: string };
  requestedBy: { id: number; fullName: string };
  status: PartRequestStatus;
  note: string | null;
  approvedBy: { id: number; fullName: string } | null;
  approvedAt: string | null;
  items: PartRequestItem[];
  createdAt: string;
  updatedAt: string;
}

export type TestResultValue = "PASS" | "FAIL";

export interface RepairLogPart {
  id: number;
  part: { id: number; sku: string; name: string; unit: string };
  quantity: number;
  createdAt: string;
}

export interface RepairLog {
  id: number;
  ticketId: number;
  technician?: { id: number; fullName: string };
  actionDescription: string;
  result?: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  parts?: RepairLogPart[];
  createdAt: string;
  updatedAt: string;
}

export interface TestResult {
  id: number;
  ticketId: number;
  testedBy?: { id: number; fullName: string };
  testName: string;
  result: TestResultValue;
  note?: string | null;
  testedAt: string;
}

export type TimelineEventType =
  | "TICKET_STATUS"
  | "ASSIGNMENT"
  | "DIAGNOSIS"
  | "QUOTATION"
  | "PART_REQUEST"
  | "INVENTORY_MOVEMENT"
  | "REPAIR_LOG"
  | "TEST_RESULT"
  | "INVOICE"
  | "PAYMENT"
  | "DELIVERY"
  | "REVIEW";

export interface TimelineEvent {
  key: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  actor: { id: number; fullName: string; role: UserRole } | null;
  occurredAt: string;
}

export interface TestingCompletionResult {
  outcome: "COMPLETED" | "REPAIR_REQUIRED";
  ticketStatus: "COMPLETED" | "REPAIRING";
}

export const INVOICE_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "E_WALLET";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface Invoice {
  id: number;
  invoiceCode: string;
  ticket: { id: number; ticketCode: string; status: TicketStatus };
  customer: { id: number; fullName: string; email: string };
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: InvoicePaymentStatus;
  createdBy: { id: number; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  paymentCode: string;
  invoiceId: number;
  ticketId: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference: string | null;
  receivedBy: { id: number; fullName: string };
  paidAt: string;
  note: string | null;
  createdAt: string;
}

export interface RefundApprover {
  id: number;
  fullName: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  reference: { type: string; id: number } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Delivery {
  id: number;
  ticket: { id: number; ticketCode: string };
  deliveredBy: { id: number; fullName: string };
  recipientName: string;
  recipientPhone: string | null;
  proofUrl: string | null;
  note: string | null;
  deliveredAt: string;
}

export interface Review {
  id: number;
  ticket: { id: number; ticketCode: string };
  customer: { id: number; fullName: string };
  rating: number;
  technicianRating: number | null;
  serviceRating: number | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardReport {
  openTickets: number;
  readyForDelivery: number;
  deliveredThisMonth: number;
  outstandingAmount: number;
  netRevenueThisMonth: number;
  lowStockParts: number;
  averageRating: number | null;
}

export interface TicketStatusReport { status: TicketStatus; total: number }
export interface RevenueReport { period: string; grossAmount: number; refundedAmount: number; netAmount: number; completedPayments: number }
export interface TechnicianPerformanceReport { technicianId: number; technicianName: string; completedTickets: number; repairLogs: number; testsRecorded: number; passedTests: number; passRate: number }
export interface RepairTimeReport { period: string; completedTickets: number; averageRepairHours: number; averageDeliveryWaitHours: number | null }
export interface PartsUsageReport { partId: number; sku: string; name: string; unit: string; quantityUsed: number; movementCount: number }
export interface LowStockReport { partId: number; sku: string; name: string; unit: string; quantityOnHand: number; minimumStock: number; shortageQuantity: number }
