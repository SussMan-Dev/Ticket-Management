import { z } from "zod";
import { INVENTORY_TRANSACTION_TYPES } from "./part.model.js";

const positiveId = z.coerce.number().int().positive();
const money = z.number().finite().min(0).max(9_999_999_999.99).multipleOf(0.01);
const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");
const sku = z.string().trim().min(1).max(100)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9][A-Z0-9._-]*$/.test(value), {
    message: "SKU may contain only letters, numbers, dot, underscore, and hyphen",
  });

const partFields = {
  sku,
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(1).max(10_000).nullable().optional(),
  unit: z.string().trim().min(1).max(50),
  purchasePrice: money,
  sellingPrice: money,
  minimumStock: z.number().int().min(0).max(1_000_000_000),
  isActive: z.boolean(),
} as const;

export const partIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export const listPartsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(255).optional(),
    isActive: booleanQuery.optional(),
    lowStock: booleanQuery.optional(),
    sortBy: z.enum(["createdAt", "sku", "name", "quantityOnHand", "sellingPrice"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }).strict(),
});

export const createPartSchema = z.object({
  body: z.object({
    sku: partFields.sku,
    name: partFields.name,
    description: partFields.description,
    unit: partFields.unit.default("piece"),
    purchasePrice: partFields.purchasePrice.default(0),
    sellingPrice: partFields.sellingPrice.default(0),
    minimumStock: partFields.minimumStock.default(0),
    isActive: partFields.isActive.default(true),
  }).strict(),
});

export const updatePartSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    sku: partFields.sku.optional(),
    name: partFields.name.optional(),
    description: partFields.description,
    unit: partFields.unit.optional(),
    purchasePrice: partFields.purchasePrice.optional(),
    sellingPrice: partFields.sellingPrice.optional(),
    minimumStock: partFields.minimumStock.optional(),
    isActive: partFields.isActive.optional(),
  }).strict().refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  ),
});

export const stockInSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    quantity: z.number().int().positive().max(1_000_000_000),
    note: z.string().trim().min(3).max(5_000),
  }).strict(),
});

export const adjustStockSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  body: z.object({
    quantityChange: z.number().int().min(-1_000_000_000).max(1_000_000_000)
      .refine((value) => value !== 0, "Quantity change must not be zero"),
    note: z.string().trim().min(3).max(5_000),
  }).strict(),
});

export const listInventoryTransactionsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    transactionType: z.enum(INVENTORY_TRANSACTION_TYPES).optional(),
  }).strict(),
});

export type PartIdParams = z.infer<typeof partIdParamsSchema>["params"];
export type ListPartsQueryInput = z.infer<typeof listPartsSchema>["query"];
export type CreatePartBody = z.infer<typeof createPartSchema>["body"];
export type UpdatePartBody = z.infer<typeof updatePartSchema>["body"];
export type StockInBody = z.infer<typeof stockInSchema>["body"];
export type AdjustStockBody = z.infer<typeof adjustStockSchema>["body"];
export type ListInventoryTransactionsQueryInput = z.infer<
  typeof listInventoryTransactionsSchema
>["query"];
