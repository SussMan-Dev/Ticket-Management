import { z } from "zod";
import { TICKET_STATUSES } from "../../common/constants/ticket-status.js";
import {
  TICKET_ATTACHMENT_TYPES,
  TICKET_PRIORITIES,
} from "./repair-ticket.model.js";

const positiveId = z.coerce.number().int().positive();
const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();
const optionalDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .nullable()
  .optional();

const listTicketQueryFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  deviceId: positiveId.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "priority", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
} as const;

function datesAreOrdered(value: {
  expectedDiagnosisAt?: Date | null;
  expectedCompletionAt?: Date | null;
}): boolean {
  if (!value.expectedDiagnosisAt || !value.expectedCompletionAt) {
    return true;
  }

  return value.expectedCompletionAt > value.expectedDiagnosisAt;
}

export const repairTicketIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listRepairTicketsSchema = z.object({
  query: z
    .object({
      ...listTicketQueryFields,
      customerId: positiveId.optional(),
    })
    .strict(),
});

export const listCustomerTicketsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  query: z.object(listTicketQueryFields).strict(),
});

export const createRepairTicketSchema = z.object({
  body: z
    .object({
      customerId: positiveId.optional(),
      deviceId: positiveId,
      title: z.string().trim().min(3).max(255),
      customerIssue: z.string().trim().min(3).max(5_000),
      repairAddress: z.string().trim().min(5).max(500),
      initialCondition: optionalText(5_000),
      accessoriesReceived: optionalText(5_000),
      priority: z.enum(TICKET_PRIORITIES).default("NORMAL"),
      expectedDiagnosisAt: optionalDate,
      expectedCompletionAt: optionalDate,
      receiveNow: z.boolean().default(false),
    })
    .strict()
    .refine(datesAreOrdered, {
      message: "Expected completion must be after expected diagnosis",
      path: ["expectedCompletionAt"],
    }),
});

export const updateRepairTicketSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      title: z.string().trim().min(3).max(255).optional(),
      customerIssue: z.string().trim().min(3).max(5_000).optional(),
      repairAddress: z.string().trim().min(5).max(500).optional(),
      initialCondition: optionalText(5_000),
      accessoriesReceived: optionalText(5_000),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      expectedDiagnosisAt: optionalDate,
      expectedCompletionAt: optionalDate,
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required")
    .refine(datesAreOrdered, {
      message: "Expected completion must be after expected diagnosis",
      path: ["expectedCompletionAt"],
    }),
});

export const receiveRepairTicketSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      reason: z.string().trim().min(3).max(5_000).optional(),
    })
    .strict()
    .default({}),
});

export const changeTicketStatusSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      status: z.enum(TICKET_STATUSES),
      reason: z.string().trim().min(3).max(5_000).optional(),
    })
    .strict(),
});

export const cancelRepairTicketSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      reason: z.string().trim().min(3).max(5_000),
    })
    .strict(),
});

export const createTicketAttachmentSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      attachmentType: z.enum(TICKET_ATTACHMENT_TYPES),
      fileUrl: z
        .string()
        .trim()
        .url()
        .max(500)
        .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
          message: "Attachment URL must use HTTP or HTTPS",
        }),
      fileName: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine((value) => !/[\\/\u0000-\u001f]/u.test(value), {
          message: "File name contains invalid characters",
        })
        .nullable()
        .optional(),
      mimeType: z
        .string()
        .trim()
        .max(100)
        .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu)
        .nullable()
        .optional(),
    })
    .strict(),
});

export const uploadTicketAttachmentSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  query: z
    .object({
      attachmentType: z.enum(TICKET_ATTACHMENT_TYPES),
      fileName: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine((value) => !/[\\/\u0000-\u001f]/u.test(value), {
          message: "File name contains invalid characters",
        }),
    })
    .strict(),
});

export type RepairTicketIdParams = z.infer<
  typeof repairTicketIdParamsSchema
>["params"];
export type ListRepairTicketsQueryInput = z.infer<
  typeof listRepairTicketsSchema
>["query"];
export type ListCustomerTicketsQueryInput = z.infer<
  typeof listCustomerTicketsSchema
>["query"];
export type CreateRepairTicketBody = z.infer<
  typeof createRepairTicketSchema
>["body"];
export type UpdateRepairTicketBody = z.infer<
  typeof updateRepairTicketSchema
>["body"];
export type ReceiveRepairTicketBody = z.infer<
  typeof receiveRepairTicketSchema
>["body"];
export type ChangeTicketStatusBody = z.infer<
  typeof changeTicketStatusSchema
>["body"];
export type CancelRepairTicketBody = z.infer<
  typeof cancelRepairTicketSchema
>["body"];
export type CreateTicketAttachmentBody = z.infer<
  typeof createTicketAttachmentSchema
>["body"];
export type UploadTicketAttachmentQuery = z.infer<
  typeof uploadTicketAttachmentSchema
>["query"];
