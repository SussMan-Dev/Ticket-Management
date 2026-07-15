import { z } from "zod";
import { PART_REQUEST_STATUSES } from "./inventory.model.js";

const positiveId = z.coerce.number().int().positive();
const positiveQuantity = z.number().int().positive().max(1_000_000_000);
const optionalNote = z.string().trim().min(1).max(5_000).nullable().optional();

const uniquePartItems = <T extends { partId: number }>(
  items: T[],
  context: z.RefinementCtx,
) => {
  const seen = new Set<number>();
  items.forEach((item, index) => {
    if (seen.has(item.partId)) {
      context.addIssue({
        code: "custom",
        message: "Each part may appear only once",
        path: [index, "partId"],
      });
    }
    seen.add(item.partId);
  });
};

export const ticketPartRequestParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const partRequestIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listPartRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(PART_REQUEST_STATUSES).optional(),
    ticketId: positiveId.optional(),
  }).strict(),
});

export const createPartRequestSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    note: optionalNote,
    items: z.array(z.object({
      partId: positiveId,
      requestedQuantity: positiveQuantity,
    }).strict()).min(1).max(100).superRefine(uniquePartItems),
  }).strict(),
});

export const approvePartRequestSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    reason: z.string().trim().min(3).max(5_000).optional(),
  }).strict().default({}),
});

export const rejectPartRequestSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    reason: z.string().trim().min(3).max(5_000),
  }).strict(),
});

export const fulfillPartRequestSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    items: z.array(z.object({
      partId: positiveId,
      quantity: positiveQuantity,
    }).strict()).min(1).max(100).superRefine(uniquePartItems),
    note: optionalNote,
  }).strict(),
});

export type TicketPartRequestParams = z.infer<
  typeof ticketPartRequestParamsSchema
>["params"];
export type PartRequestIdParams = z.infer<typeof partRequestIdParamsSchema>["params"];
export type ListPartRequestsQueryInput = z.infer<typeof listPartRequestsSchema>["query"];
export type CreatePartRequestBody = z.infer<typeof createPartRequestSchema>["body"];
export type ApprovePartRequestBody = z.infer<typeof approvePartRequestSchema>["body"];
export type RejectPartRequestBody = z.infer<typeof rejectPartRequestSchema>["body"];
export type FulfillPartRequestBody = z.infer<typeof fulfillPartRequestSchema>["body"];

