import { z } from "zod";

const money = z.number({ error: "Số tiền không hợp lệ" })
  .positive("Số tiền phải lớn hơn 0")
  .max(9_999_999_999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    "Chỉ được nhập tối đa 2 chữ số thập phân",
  );

export const paymentFormSchema = z.object({
  amount: money,
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "E_WALLET"]),
  transactionReference: z.string().trim().max(191).optional(),
  note: z.string().trim().max(5_000).optional(),
});

export const refundFormSchema = z.object({
  managerApprovalId: z.number().int().positive("Chọn quản lý phê duyệt"),
  reason: z.string().trim().min(3, "Lý do cần ít nhất 3 ký tự").max(5_000),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type RefundFormValues = z.infer<typeof refundFormSchema>;

