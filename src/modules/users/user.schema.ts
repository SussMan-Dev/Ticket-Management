import { z } from "zod";
import { USER_ROLES } from "../../common/constants/roles.js";
import { passwordSchema } from "../auth/auth.schema.js";
import { STAFF_ROLES, USER_ACCOUNT_STATUSES } from "./user.model.js";

const positiveId = z.coerce.number().int().positive();
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Phone must contain 8 to 15 digits");

export const userIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listUsersSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().trim().min(1).max(191).optional(),
      role: z.enum(USER_ROLES).optional(),
      status: z.enum(USER_ACCOUNT_STATUSES).optional(),
      sortBy: z
        .enum(["createdAt", "fullName", "email", "status", "role"])
        .default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const createStaffSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150),
      email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
      phone: phoneSchema.optional(),
      password: passwordSchema,
      role: z.enum(STAFF_ROLES),
    })
    .strict(),
});

export const updateUserSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150).optional(),
      phone: phoneSchema.nullable().optional(),
      avatarUrl: z.string().trim().url().max(500).nullable().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const updateUserStatusSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({ status: z.enum(USER_ACCOUNT_STATUSES) }).strict(),
});

export const updateUserRoleSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({ role: z.enum(USER_ROLES) }).strict(),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>["params"];
export type ListUsersQueryInput = z.infer<typeof listUsersSchema>["query"];
export type CreateStaffBody = z.infer<typeof createStaffSchema>["body"];
export type UpdateUserBody = z.infer<typeof updateUserSchema>["body"];
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusSchema>["body"];
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleSchema>["body"];
