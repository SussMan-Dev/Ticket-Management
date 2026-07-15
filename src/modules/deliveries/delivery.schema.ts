import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();

export const ticketDeliveryParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const createDeliverySchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({
    recipientName: z.string().trim().min(2).max(150),
    recipientPhone: z.string().trim().regex(/^\+?[0-9][0-9 .()-]{6,19}$/)
      .nullable().optional(),
    proofUrl: z.string().trim().url().max(500)
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "Proof URL must use HTTP or HTTPS",
      }).nullable().optional(),
    note: optionalText(5_000),
    paymentExceptionReason: optionalText(5_000),
  }).strict(),
});

export const closeDeliverySchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({ reason: z.string().trim().min(3).max(2_000).nullable().optional() }).strict(),
});

export type TicketDeliveryParams = z.infer<
  typeof ticketDeliveryParamsSchema
>["params"];
export type CreateDeliveryBody = z.infer<typeof createDeliverySchema>["body"];
export type CloseDeliveryBody = z.infer<typeof closeDeliverySchema>["body"];
