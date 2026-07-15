export type ReportGroupBy = "day" | "month";

export interface ReportDateRangeQuery {
  from?: Date;
  to?: Date;
}

export interface RevenueReportQuery extends ReportDateRangeQuery {
  groupBy: ReportGroupBy;
}

