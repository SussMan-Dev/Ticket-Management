import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { DashboardReport, LowStockReport, PartsUsageReport, RepairTimeReport, RevenueReport, TechnicianPerformanceReport, TicketStatusReport } from "../../types/domain";

export interface ReportRange extends Record<string, string> { from: string; to: string }

function useReport<T>(name: string, path: string, params: Record<string, string> | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports(name, params),
    queryFn: async () => (await apiClient.get<T>(`${path}${params ? toQueryString(params) : ""}`)).data,
    enabled,
  });
}

export const useDashboardReport = (enabled: boolean) => useReport<DashboardReport>("dashboard", "/reports/dashboard", undefined, enabled);
export const useTicketStatusReport = (range: ReportRange, enabled: boolean) => useReport<TicketStatusReport[]>("tickets-by-status", "/reports/tickets-by-status", range, enabled);
export const useRevenueReport = (range: ReportRange, enabled: boolean) => useReport<RevenueReport[]>("revenue", "/reports/revenue", { ...range, groupBy: "day" }, enabled);
export const useTechnicianPerformanceReport = (range: ReportRange, enabled: boolean) => useReport<TechnicianPerformanceReport[]>("technician-performance", "/reports/technician-performance", range, enabled);
export const useRepairTimeReport = (range: ReportRange, enabled: boolean) => useReport<RepairTimeReport[]>("repair-time", "/reports/repair-time", range, enabled);
export const usePartsUsageReport = (range: ReportRange) => useReport<PartsUsageReport[]>("parts-usage", "/reports/parts-usage", range);
export const useLowStockReport = () => useReport<LowStockReport[]>("low-stock", "/reports/low-stock", undefined);
