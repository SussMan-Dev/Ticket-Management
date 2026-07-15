import { z } from "zod";

const positiveId = z.coerce.number().int().positive();

export const assignTicketSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z
    .object({
      technicianId: positiveId,
      note: z.string().trim().min(3).max(5_000).nullable().optional(),
    })
    .strict(),
});

export const reassignTicketSchema = z.object({
  params: z.object({ ticketId: positiveId }).strict(),
  body: z
    .object({
      technicianId: positiveId,
      note: z.string().trim().min(3).max(5_000),
    })
    .strict(),
});

export const listAssignableTechniciansSchema = z.object({
  query: z.object({ search: z.string().trim().min(1).max(100).optional() }).strict(),
});

export type TicketAssignmentParams = z.infer<typeof assignTicketSchema>["params"];
export type AssignTicketBody = z.infer<typeof assignTicketSchema>["body"];
export type ReassignTicketBody = z.infer<typeof reassignTicketSchema>["body"];
export type ListAssignableTechniciansQueryInput = z.infer<typeof listAssignableTechniciansSchema>["query"];
