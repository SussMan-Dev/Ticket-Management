import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();
const money = z.number().finite().min(0).max(9_999_999_999.99).multipleOf(0.01);
const estimatedHours = z.number().finite().min(0).max(999_999.99).nullable();

const diagnosisParts = z
  .array(
    z
      .object({
        partId: positiveId,
        quantity: z.number().int().positive().max(1_000_000),
        note: optionalText(5_000),
      })
      .strict(),
  )
  .max(100)
  .superRefine((parts, context) => {
    const seen = new Set<number>();

    parts.forEach((part, index) => {
      if (seen.has(part.partId)) {
        context.addIssue({
          code: "custom",
          message: "Each part may appear only once",
          path: [index, "partId"],
        });
      }
      seen.add(part.partId);
    });
  });

const diagnosisFields = {
  actualIssue: z.string().trim().min(3).max(10_000),
  rootCause: optionalText(10_000),
  proposedSolution: z.string().trim().min(3).max(10_000),
  laborCost: money,
  estimatedHours: estimatedHours.optional(),
  dataLossRisk: z.boolean(),
  riskNote: optionalText(10_000),
} as const;

export const ticketDiagnosisParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const diagnosisIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const createDiagnosisSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z
    .object({
      actualIssue: diagnosisFields.actualIssue,
      rootCause: diagnosisFields.rootCause,
      proposedSolution: diagnosisFields.proposedSolution,
      laborCost: diagnosisFields.laborCost.default(0),
      estimatedHours: diagnosisFields.estimatedHours,
      dataLossRisk: diagnosisFields.dataLossRisk.default(false),
      riskNote: diagnosisFields.riskNote,
      parts: diagnosisParts.default([]),
    })
    .strict(),
});

export const updateDiagnosisSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      actualIssue: diagnosisFields.actualIssue.optional(),
      rootCause: diagnosisFields.rootCause,
      proposedSolution: diagnosisFields.proposedSolution.optional(),
      laborCost: diagnosisFields.laborCost.optional(),
      estimatedHours: diagnosisFields.estimatedHours,
      dataLossRisk: diagnosisFields.dataLossRisk.optional(),
      riskNote: diagnosisFields.riskNote,
      parts: diagnosisParts.optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const submitDiagnosisSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      reason: z.string().trim().min(3).max(5_000).optional(),
    })
    .strict()
    .default({}),
});

export const requestDiagnosisRevisionSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      reason: z.string().trim().min(3).max(5_000),
    })
    .strict(),
});

export const approveDiagnosisSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      reason: z.string().trim().min(3).max(5_000).optional(),
    })
    .strict()
    .default({}),
});

export type TicketDiagnosisParams = z.infer<
  typeof ticketDiagnosisParamsSchema
>["params"];
export type DiagnosisIdParams = z.infer<typeof diagnosisIdParamsSchema>["params"];
export type CreateDiagnosisBody = z.infer<typeof createDiagnosisSchema>["body"];
export type UpdateDiagnosisBody = z.infer<typeof updateDiagnosisSchema>["body"];
export type SubmitDiagnosisBody = z.infer<typeof submitDiagnosisSchema>["body"];
export type RequestDiagnosisRevisionBody = z.infer<
  typeof requestDiagnosisRevisionSchema
>["body"];
export type ApproveDiagnosisBody = z.infer<typeof approveDiagnosisSchema>["body"];
