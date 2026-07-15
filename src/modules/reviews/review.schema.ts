import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const rating = z.number().int().min(1).max(5);
const optionalRating = rating.nullable().optional();
const optionalComment = z.string().trim().min(1).max(5_000).nullable().optional();

export const ticketReviewParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const reviewIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const createReviewSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    rating,
    technicianRating: optionalRating,
    serviceRating: optionalRating,
    comment: optionalComment,
  }).strict(),
});

export const updateReviewSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    rating: rating.optional(),
    technicianRating: optionalRating,
    serviceRating: optionalRating,
    comment: optionalComment,
  }).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  }),
});

export type TicketReviewParams = z.infer<typeof ticketReviewParamsSchema>["params"];
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>["params"];
export type CreateReviewBody = z.infer<typeof createReviewSchema>["body"];
export type UpdateReviewBody = z.infer<typeof updateReviewSchema>["body"];

