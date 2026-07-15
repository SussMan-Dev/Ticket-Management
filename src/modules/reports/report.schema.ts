import { z } from "zod";

const dateRangeFields = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
} as const;

export const reportDateRangeSchema = z.object({
  query: z.object(dateRangeFields).strict(),
});

export const revenueReportSchema = z.object({
  query: z.object({
    ...dateRangeFields,
    groupBy: z.enum(["day", "month"]).default("day"),
  }).strict(),
});

export type ReportDateRangeQueryInput = z.infer<
  typeof reportDateRangeSchema
>["query"];
export type RevenueReportQueryInput = z.infer<
  typeof revenueReportSchema
>["query"];

