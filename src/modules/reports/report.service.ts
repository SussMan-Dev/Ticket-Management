import { BadRequestError } from "../../common/errors/bad-request-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import type { ReportDateRangeQuery, RevenueReportQuery } from "./report.dto.js";
import { toDashboardReport, toLowStockReport, toPartsUsageReport, toRepairTimeReport, toRevenueReport, toTechnicianPerformanceReport, toTicketStatusReport } from "./report.model.js";
import { reportRepository, type ReportRepository } from "./report.repository.js";

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1_000;

export class ReportService {
  public constructor(
    private readonly repository: ReportRepository = reportRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async dashboard(actor: Express.AuthenticatedUser) {
    this.assertManager(actor);
    return toDashboardReport(await this.repository.dashboard());
  }

  public async ticketsByStatus(actor: Express.AuthenticatedUser, query: ReportDateRangeQuery) {
    this.assertManager(actor);
    const { from, to } = this.range(query);
    return (await this.repository.ticketsByStatus(from, to)).map(toTicketStatusReport);
  }

  public async revenue(actor: Express.AuthenticatedUser, query: RevenueReportQuery) {
    this.assertManager(actor);
    const { from, to } = this.range(query);
    return (await this.repository.revenue(from, to, query.groupBy)).map(toRevenueReport);
  }

  public async technicianPerformance(actor: Express.AuthenticatedUser, query: ReportDateRangeQuery) {
    this.assertManager(actor);
    const { from, to } = this.range(query);
    return (await this.repository.technicianPerformance(from, to)).map(toTechnicianPerformanceReport);
  }

  public async repairTime(actor: Express.AuthenticatedUser, query: ReportDateRangeQuery) {
    this.assertManager(actor);
    const { from, to } = this.range(query);
    return (await this.repository.repairTime(from, to)).map(toRepairTimeReport);
  }

  public async partsUsage(actor: Express.AuthenticatedUser, query: ReportDateRangeQuery) {
    this.assertInventoryReportRole(actor);
    const { from, to } = this.range(query);
    return (await this.repository.partsUsage(from, to)).map(toPartsUsageReport);
  }

  public async lowStock(actor: Express.AuthenticatedUser) {
    this.assertInventoryReportRole(actor);
    return (await this.repository.lowStock()).map(toLowStockReport);
  }

  private range(query: ReportDateRangeQuery): { from: Date; to: Date } {
    const to = query.to ?? this.now();
    const from = query.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1_000);
    if (from >= to) {
      throw new BadRequestError("Report start must be before end", "INVALID_REPORT_RANGE");
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestError(
        "Report range may not exceed 366 days",
        "REPORT_RANGE_TOO_LARGE",
      );
    }
    return { from, to };
  }

  private assertManager(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "MANAGER") {
      throw new ForbiddenError("Manager report access is required", "FORBIDDEN");
    }
  }

  private assertInventoryReportRole(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "MANAGER" && actor.role !== "INVENTORY_STAFF") {
      throw new ForbiddenError("Inventory report access is required", "FORBIDDEN");
    }
  }
}

export const reportService = new ReportService();
