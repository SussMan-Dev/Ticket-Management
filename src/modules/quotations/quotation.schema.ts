import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const quantity = z.number().finite().positive().max(9_999_999.99).multipleOf(0.01);
const money = z.number().finite().min(0).max(9_999_999_999.99).multipleOf(0.01);
const expiresAt = z.coerce.date().nullable();

const partItem = z
  .object({
    itemType: z.literal("PART"),
    partId: positiveId,
    quantity,
  })
  .strict();

const serviceItem = z
  .object({
    itemType: z.enum(["LABOR", "OTHER"]),
    description: z.string().trim().min(1).max(500),
    quantity,
    unitPrice: money,
  })
  .strict();

const quotationItems = z
  .array(z.discriminatedUnion("itemType", [partItem, serviceItem]))
  .min(1)
  .max(100)
  .superRefine((items, context) => {
    const partIds = new Set<number>();
    items.forEach((item, index) => {
      if (item.itemType !== "PART") return;
      if (partIds.has(item.partId)) {
        context.addIssue({
          code: "custom",
          message: "Each part may appear only once",
          path: [index, "partId"],
        });
      }
      partIds.add(item.partId);
    });
  });

const actionBody = z
  .object({ reason: z.string().trim().min(3).max(5_000).optional() })
  .strict()
  .default({});

const responseBody = z
  .object({ note: z.string().trim().min(1).max(5_000).nullable().optional() })
  .strict()
  .default({});

export const ticketQuotationParamsSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
});

export const quotationIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const createQuotationSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z.object({ expiresAt: expiresAt.optional() }).strict().default({}),
});

export const updateQuotationSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({ expiresAt: expiresAt.optional(), items: quotationItems.optional() })
    .strict()
    .refine((body) => Object.keys(body).length > 0, "At least one field is required"),
});

export const quotationActionSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: actionBody,
});

export const quotationResponseSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: responseBody,
});

export type TicketQuotationParams = z.infer<typeof ticketQuotationParamsSchema>["params"];
export type QuotationIdParams = z.infer<typeof quotationIdParamsSchema>["params"];
export type CreateQuotationBody = z.infer<typeof createQuotationSchema>["body"];
export type UpdateQuotationBody = z.infer<typeof updateQuotationSchema>["body"];
export type QuotationActionBody = z.infer<typeof quotationActionSchema>["body"];
export type QuotationResponseBody = z.infer<typeof quotationResponseSchema>["body"];
