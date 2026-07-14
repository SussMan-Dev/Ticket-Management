import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Phone must contain 8 to 15 digits");

export const passwordSchema = z
  .string()
  .min(8)
  .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
  .refine((value) => /[0-9]/.test(value), "Password must contain a number")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must not exceed 72 bytes",
  );

export const registerSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150),
      email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
      phone: phoneSchema.optional(),
      password: passwordSchema,
      address: z.string().trim().max(500).optional(),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
      password: z.string().min(1).max(1_024),
    })
    .strict(),
});

export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
