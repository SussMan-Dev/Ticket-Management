import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const nullableTrimmedString = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();
const imeiSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{14,16}$/, "IMEI must contain 14 to 16 digits")
  .nullable();

const listDeviceQueryFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(191).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "model"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
} as const;

export const deviceIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listDevicesSchema = z.object({
  query: z
    .object({
      ...listDeviceQueryFields,
      customerId: positiveId.optional(),
    })
    .strict(),
});

export const listCustomerDevicesSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  query: z.object(listDeviceQueryFields).strict(),
});

export const createDeviceSchema = z.object({
  body: z
    .object({
      customerId: positiveId.optional(),
      categoryId: positiveId,
      brandId: positiveId.nullable().optional(),
      model: nullableTrimmedString(150).optional(),
      serialNumber: nullableTrimmedString(191).optional(),
      imei: imeiSchema.optional(),
      color: nullableTrimmedString(50).optional(),
      description: nullableTrimmedString(5_000).optional(),
    })
    .strict(),
});

export const updateDeviceSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z
    .object({
      categoryId: positiveId.optional(),
      brandId: positiveId.nullable().optional(),
      model: nullableTrimmedString(150).optional(),
      serialNumber: nullableTrimmedString(191).optional(),
      imei: imeiSchema.optional(),
      color: nullableTrimmedString(50).optional(),
      description: nullableTrimmedString(5_000).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const catalogListSchema = z.object({
  query: z.object({}).strict(),
});

export type DeviceIdParams = z.infer<typeof deviceIdParamsSchema>["params"];
export type ListDevicesQueryInput = z.infer<typeof listDevicesSchema>["query"];
export type ListCustomerDevicesQueryInput = z.infer<
  typeof listCustomerDevicesSchema
>["query"];
export type CreateDeviceBody = z.infer<typeof createDeviceSchema>["body"];
export type UpdateDeviceBody = z.infer<typeof updateDeviceSchema>["body"];
