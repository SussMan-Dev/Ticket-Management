import { z } from "zod";
import { TEST_RESULT_VALUES } from "./repair-action.model.js";

const positiveId = z.coerce.number().int().positive();
const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();
const optionalDate = z.string().datetime({ offset: true })
  .transform((value) => new Date(value)).nullable().optional();

const repairLogParts = z.array(z.object({
  partId: positiveId,
  quantity: z.number().int().positive().max(1_000_000_000),
}).strict()).max(100).superRefine((parts, context) => {
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

function validTimeRange(value: { startedAt?: Date | null; finishedAt?: Date | null }) {
  return !value.startedAt || !value.finishedAt || value.finishedAt >= value.startedAt;
}

export const ticketRepairActionParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const repairLogIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const createRepairLogSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    actionDescription: z.string().trim().min(3).max(10_000),
    result: optionalText(10_000),
    startedAt: optionalDate,
    finishedAt: optionalDate,
    parts: repairLogParts.default([]),
  }).strict().refine(validTimeRange, {
    message: "Finished time must be after started time",
    path: ["finishedAt"],
  }),
});

export const updateRepairLogSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    actionDescription: z.string().trim().min(3).max(10_000).optional(),
    result: optionalText(10_000),
    startedAt: optionalDate,
    finishedAt: optionalDate,
    parts: repairLogParts.optional(),
  }).strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required")
    .refine(validTimeRange, {
      message: "Finished time must be after started time",
      path: ["finishedAt"],
    }),
});

export const createTestResultSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    testName: z.string().trim().min(2).max(255),
    result: z.enum(TEST_RESULT_VALUES),
    note: optionalText(5_000),
  }).strict(),
});

export const completeTestingSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    reason: z.string().trim().min(3).max(5_000).optional(),
  }).strict().default({}),
});

export type TicketRepairActionParams = z.infer<
  typeof ticketRepairActionParamsSchema
>["params"];
export type RepairLogIdParams = z.infer<typeof repairLogIdParamsSchema>["params"];
export type CreateRepairLogBody = z.infer<typeof createRepairLogSchema>["body"];
export type UpdateRepairLogBody = z.infer<typeof updateRepairLogSchema>["body"];
export type CreateTestResultBody = z.infer<typeof createTestResultSchema>["body"];
export type CompleteTestingBody = z.infer<typeof completeTestingSchema>["body"];
