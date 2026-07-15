import type { Pool } from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  DashboardReportRow,
  LowStockReportRow,
  PartsUsageReportRow,
  RepairTimeReportRow,
  RevenueReportRow,
  TechnicianPerformanceRow,
  TicketStatusReportRow,
} from "./report.model.js";

export class ReportRepository {
  public async dashboard(executor: Pool = pool): Promise<DashboardReportRow> {
    const [rows] = await executor.execute<DashboardReportRow[]>(
      `
        SELECT
          (SELECT COUNT(*) FROM repair_tickets rt
            WHERE rt.deleted_at IS NULL AND rt.status NOT IN ('CLOSED', 'CANCELLED')) AS open_tickets,
          (SELECT COUNT(*) FROM repair_tickets rt
            WHERE rt.deleted_at IS NULL AND rt.status = 'READY_FOR_DELIVERY') AS ready_for_delivery,
          (SELECT COUNT(*) FROM deliveries d
            WHERE d.delivered_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')) AS delivered_this_month,
          (SELECT COALESCE(SUM(i.total_amount - i.paid_amount), 0) FROM invoices i
            WHERE i.paid_amount < i.total_amount) AS outstanding_amount,
          (SELECT COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END), 0)
            FROM payments p
            WHERE p.paid_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')) AS net_revenue_this_month,
          (SELECT COUNT(*) FROM parts p
            WHERE p.is_active = TRUE AND p.quantity_on_hand <= p.minimum_stock) AS low_stock_parts,
          (SELECT ROUND(AVG(r.rating), 2) FROM reviews r) AS average_rating
      `,
    );
    const row = rows[0];
    if (!row) throw new Error("Dashboard report returned no row");
    return row;
  }

  public async ticketsByStatus(
    from: Date,
    to: Date,
    executor: Pool = pool,
  ): Promise<TicketStatusReportRow[]> {
    const [rows] = await executor.execute<TicketStatusReportRow[]>(
      `
        SELECT rt.status, COUNT(rt.id) AS total
        FROM repair_tickets rt
        WHERE rt.deleted_at IS NULL AND rt.created_at >= ? AND rt.created_at < ?
        GROUP BY rt.status
        ORDER BY total DESC, rt.status ASC
      `,
      [from, to],
    );
    return rows;
  }

  public async revenue(
    from: Date,
    to: Date,
    groupBy: "day" | "month",
    executor: Pool = pool,
  ): Promise<RevenueReportRow[]> {
    const period = groupBy === "month"
      ? "DATE_FORMAT(p.paid_at, '%Y-%m')"
      : "DATE_FORMAT(p.paid_at, '%Y-%m-%d')";
    const [rows] = await executor.execute<RevenueReportRow[]>(
      `
        SELECT
          ${period} AS period,
          COALESCE(SUM(CASE WHEN p.status IN ('COMPLETED', 'REFUNDED') THEN p.amount ELSE 0 END), 0) AS gross_amount,
          COALESCE(SUM(CASE WHEN p.status = 'REFUNDED' THEN p.amount ELSE 0 END), 0) AS refunded_amount,
          COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END), 0) AS net_amount,
          SUM(CASE WHEN p.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_payments
        FROM payments p
        WHERE p.paid_at >= ? AND p.paid_at < ?
        GROUP BY ${period}
        ORDER BY period ASC
      `,
      [from, to],
    );
    return rows;
  }

  public async technicianPerformance(
    from: Date,
    to: Date,
    executor: Pool = pool,
  ): Promise<TechnicianPerformanceRow[]> {
    const [rows] = await executor.execute<TechnicianPerformanceRow[]>(
      `
        SELECT
          u.id AS technician_id,
          u.full_name AS technician_name,
          COALESCE(completed.completed_tickets, 0) AS completed_tickets,
          COALESCE(logs.repair_logs, 0) AS repair_logs,
          COALESCE(tests.tests_recorded, 0) AS tests_recorded,
          COALESCE(tests.passed_tests, 0) AS passed_tests,
          CASE WHEN COALESCE(tests.tests_recorded, 0) = 0 THEN 0
            ELSE ROUND(tests.passed_tests * 100 / tests.tests_recorded, 2) END AS pass_rate
        FROM users u
        INNER JOIN roles role ON role.id = u.role_id AND role.code = 'TECHNICIAN'
        LEFT JOIN (
          SELECT tsh.changed_by, COUNT(DISTINCT tsh.ticket_id) AS completed_tickets
          FROM ticket_status_history tsh
          WHERE tsh.to_status = 'COMPLETED' AND tsh.created_at >= ? AND tsh.created_at < ?
          GROUP BY tsh.changed_by
        ) completed ON completed.changed_by = u.id
        LEFT JOIN (
          SELECT rl.technician_id, COUNT(rl.id) AS repair_logs
          FROM repair_logs rl
          WHERE rl.created_at >= ? AND rl.created_at < ?
          GROUP BY rl.technician_id
        ) logs ON logs.technician_id = u.id
        LEFT JOIN (
          SELECT tr.tested_by, COUNT(tr.id) AS tests_recorded,
            SUM(CASE WHEN tr.result = 'PASS' THEN 1 ELSE 0 END) AS passed_tests
          FROM test_results tr
          WHERE tr.tested_at >= ? AND tr.tested_at < ?
          GROUP BY tr.tested_by
        ) tests ON tests.tested_by = u.id
        WHERE u.deleted_at IS NULL
        ORDER BY completed_tickets DESC, repair_logs DESC, u.full_name ASC
      `,
      [from, to, from, to, from, to],
    );
    return rows;
  }

  public async repairTime(
    from: Date,
    to: Date,
    executor: Pool = pool,
  ): Promise<RepairTimeReportRow[]> {
    const [rows] = await executor.execute<RepairTimeReportRow[]>(
      `
        SELECT
          DATE_FORMAT(rt.completed_at, '%Y-%m') AS period,
          COUNT(rt.id) AS completed_tickets,
          ROUND(AVG(TIMESTAMPDIFF(MINUTE, rt.received_at, rt.completed_at)) / 60, 2) AS average_repair_hours,
          ROUND(AVG(CASE WHEN rt.delivered_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MINUTE, rt.completed_at, rt.delivered_at) END) / 60, 2) AS average_delivery_wait_hours
        FROM repair_tickets rt
        WHERE rt.completed_at >= ? AND rt.completed_at < ? AND rt.received_at IS NOT NULL
        GROUP BY DATE_FORMAT(rt.completed_at, '%Y-%m')
        ORDER BY period ASC
      `,
      [from, to],
    );
    return rows;
  }

  public async partsUsage(
    from: Date,
    to: Date,
    executor: Pool = pool,
  ): Promise<PartsUsageReportRow[]> {
    const [rows] = await executor.execute<PartsUsageReportRow[]>(
      `
        SELECT
          p.id AS part_id,
          p.sku,
          p.name,
          p.unit,
          COALESCE(SUM(it.quantity), 0) AS quantity_used,
          COUNT(it.id) AS movement_count
        FROM inventory_transactions it
        INNER JOIN parts p ON p.id = it.part_id
        WHERE it.transaction_type = 'STOCK_OUT' AND it.created_at >= ? AND it.created_at < ?
        GROUP BY p.id, p.sku, p.name, p.unit
        ORDER BY quantity_used DESC, p.sku ASC
      `,
      [from, to],
    );
    return rows;
  }

  public async lowStock(executor: Pool = pool): Promise<LowStockReportRow[]> {
    const [rows] = await executor.execute<LowStockReportRow[]>(
      `
        SELECT
          p.id AS part_id,
          p.sku,
          p.name,
          p.unit,
          p.quantity_on_hand,
          p.minimum_stock,
          GREATEST(p.minimum_stock - p.quantity_on_hand, 0) AS shortage_quantity
        FROM parts p
        WHERE p.is_active = TRUE AND p.quantity_on_hand <= p.minimum_stock
        ORDER BY shortage_quantity DESC, p.sku ASC
      `,
    );
    return rows;
  }
}

export const reportRepository = new ReportRepository();
