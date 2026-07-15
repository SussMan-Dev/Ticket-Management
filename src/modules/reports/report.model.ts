import type { RowDataPacket } from "mysql2";
import type { TicketStatus } from "../../common/constants/ticket-status.js";

export interface DashboardReportRow extends RowDataPacket {
  open_tickets: number;
  ready_for_delivery: number;
  delivered_this_month: number;
  outstanding_amount: number;
  net_revenue_this_month: number;
  low_stock_parts: number;
  average_rating: number | null;
}

export interface TicketStatusReportRow extends RowDataPacket {
  status: TicketStatus;
  total: number;
}

export interface RevenueReportRow extends RowDataPacket {
  period: string;
  gross_amount: number;
  refunded_amount: number;
  net_amount: number;
  completed_payments: number;
}

export interface TechnicianPerformanceRow extends RowDataPacket {
  technician_id: number;
  technician_name: string;
  completed_tickets: number;
  repair_logs: number;
  tests_recorded: number;
  passed_tests: number;
  pass_rate: number;
}

export interface RepairTimeReportRow extends RowDataPacket {
  period: string;
  completed_tickets: number;
  average_repair_hours: number;
  average_delivery_wait_hours: number | null;
}

export interface PartsUsageReportRow extends RowDataPacket {
  part_id: number;
  sku: string;
  name: string;
  unit: string;
  quantity_used: number;
  movement_count: number;
}

export interface LowStockReportRow extends RowDataPacket {
  part_id: number;
  sku: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  minimum_stock: number;
  shortage_quantity: number;
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

export const toDashboardReport = (row: DashboardReportRow): DashboardReport => ({
  openTickets: row.open_tickets,
  readyForDelivery: row.ready_for_delivery,
  deliveredThisMonth: row.delivered_this_month,
  outstandingAmount: row.outstanding_amount,
  netRevenueThisMonth: row.net_revenue_this_month,
  lowStockParts: row.low_stock_parts,
  averageRating: row.average_rating,
});

export const toTicketStatusReport = (row: TicketStatusReportRow): TicketStatusReport => ({ status: row.status, total: row.total });
export const toRevenueReport = (row: RevenueReportRow): RevenueReport => ({ period: row.period, grossAmount: row.gross_amount, refundedAmount: row.refunded_amount, netAmount: row.net_amount, completedPayments: row.completed_payments });
export const toTechnicianPerformanceReport = (row: TechnicianPerformanceRow): TechnicianPerformanceReport => ({ technicianId: row.technician_id, technicianName: row.technician_name, completedTickets: row.completed_tickets, repairLogs: row.repair_logs, testsRecorded: row.tests_recorded, passedTests: row.passed_tests, passRate: row.pass_rate });
export const toRepairTimeReport = (row: RepairTimeReportRow): RepairTimeReport => ({ period: row.period, completedTickets: row.completed_tickets, averageRepairHours: row.average_repair_hours, averageDeliveryWaitHours: row.average_delivery_wait_hours });
export const toPartsUsageReport = (row: PartsUsageReportRow): PartsUsageReport => ({ partId: row.part_id, sku: row.sku, name: row.name, unit: row.unit, quantityUsed: row.quantity_used, movementCount: row.movement_count });
export const toLowStockReport = (row: LowStockReportRow): LowStockReport => ({ partId: row.part_id, sku: row.sku, name: row.name, unit: row.unit, quantityOnHand: row.quantity_on_hand, minimumStock: row.minimum_stock, shortageQuantity: row.shortage_quantity });
