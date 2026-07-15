import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { ReportDateRangeQuery, RevenueReportQuery } from "./report.dto.js";
import type { ReportDateRangeQueryInput, RevenueReportQueryInput } from "./report.schema.js";
import { reportService } from "./report.service.js";

function actor(request: Request): Express.AuthenticatedUser {
  if (!request.user) throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  return request.user;
}

export const reportController = {
  async dashboard(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Dashboard report retrieved successfully", data: await reportService.dashboard(actor(request)) });
  },
  async ticketsByStatus(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Ticket status report retrieved successfully", data: await reportService.ticketsByStatus(actor(request), request.validated?.query as ReportDateRangeQueryInput as ReportDateRangeQuery) });
  },
  async revenue(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Revenue report retrieved successfully", data: await reportService.revenue(actor(request), request.validated?.query as RevenueReportQueryInput as RevenueReportQuery) });
  },
  async technicianPerformance(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Technician performance report retrieved successfully", data: await reportService.technicianPerformance(actor(request), request.validated?.query as ReportDateRangeQueryInput as ReportDateRangeQuery) });
  },
  async repairTime(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Repair time report retrieved successfully", data: await reportService.repairTime(actor(request), request.validated?.query as ReportDateRangeQueryInput as ReportDateRangeQuery) });
  },
  async partsUsage(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Parts usage report retrieved successfully", data: await reportService.partsUsage(actor(request), request.validated?.query as ReportDateRangeQueryInput as ReportDateRangeQuery) });
  },
  async lowStock(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, { message: "Low stock report retrieved successfully", data: await reportService.lowStock(actor(request)) });
  },
};

