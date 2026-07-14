import { z } from "zod";
import { passwordSchema } from "../auth/auth.schema.js";
import { USER_ACCOUNT_STATUSES } from "../users/user.model.js";

const positiveId = z.coerce.number().int().positive();
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Phone must contain 8 to 15 digits");

export const customerIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listCustomersSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().trim().min(1).max(191).optional(),
      status: z.enum(USER_ACCOUNT_STATUSES).optional(),
      sortBy: z.enum(["createdAt", "fullName", "email", "status"]).default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const createCustomerSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150),
      email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
      phone: phoneSchema.optional(),
      password: passwordSchema,
      address: z.string().trim().max(500).optional(),
      notes: z.string().trim().max(5_000).optional(),
    })
    .strict(),
});

export const updateCustomerSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150).optional(),
      phone: phoneSchema.nullable().optional(),
      address: z.string().trim().max(500).nullable().optional(),
      notes: z.string().trim().max(5_000).nullable().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export type CustomerIdParams = z.infer<typeof customerIdParamsSchema>["params"];
export type ListCustomersQueryInput = z.infer<typeof listCustomersSchema>["query"];
export type CreateCustomerBody = z.infer<typeof createCustomerSchema>["body"];
export type UpdateCustomerBody = z.infer<typeof updateCustomerSchema>["body"];
