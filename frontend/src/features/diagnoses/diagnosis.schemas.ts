import { z } from "zod";

const optionalText = (max: number) => z.union([z.string().trim().min(1).max(max), z.literal("")]).optional();

export const diagnosisSchema = z.object({
  actualIssue: z.string().trim().min(3, "Mô tả cần ít nhất 3 ký tự").max(10000),
  rootCause: optionalText(10000),
  proposedSolution: z.string().trim().min(3, "Giải pháp cần ít nhất 3 ký tự").max(10000),
  laborCost: z.number().finite().min(0).max(9_999_999_999.99),
  estimatedHours: z.union([z.number().finite().min(0).max(999_999.99), z.literal("")]).optional(),
  dataLossRisk: z.boolean(),
  riskNote: optionalText(10000),
  parts: z.array(z.object({
    partId: z.number().int().positive(),
    quantity: z.number().int().positive().max(1_000_000),
    note: optionalText(5000),
  })).max(100).superRefine((parts, context) => {
    const seen = new Set<number>();
    parts.forEach((part, index) => {
      if (seen.has(part.partId)) context.addIssue({ code: "custom", path: [index, "partId"], message: "Linh kiện không được trùng" });
      seen.add(part.partId);
    });
  }),
});

export type DiagnosisValues = z.infer<typeof diagnosisSchema>;
