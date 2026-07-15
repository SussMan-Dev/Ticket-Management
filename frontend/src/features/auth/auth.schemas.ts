import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự")
  .refine((value) => /[a-z]/.test(value), "Cần ít nhất một chữ thường")
  .refine((value) => /[A-Z]/.test(value), "Cần ít nhất một chữ hoa")
  .refine((value) => /[0-9]/.test(value), "Cần ít nhất một chữ số")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Mật khẩu tối đa 72 byte");

const phoneSchema = z.string().regex(/^\+?[0-9]{8,15}$/, "Số điện thoại gồm 8–15 chữ số");

export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ").max(191),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(1024),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên cần ít nhất 2 ký tự").max(150),
  email: z.string().trim().email("Email không hợp lệ").max(191),
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  address: z.string().trim().max(500).optional(),
}).superRefine((values, context) => {
  if (values.password !== values.confirmPassword) {
    context.addIssue({
      code: "custom",
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmPassword"],
    });
  }
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
