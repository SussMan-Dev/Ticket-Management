import { z } from "zod";

const nullableText = (maximum: number) => z.union([z.string().trim().min(1).max(maximum), z.literal("")]).optional();

export const ticketSchema = z.object({
  customerId: z.number().int().positive().optional(),
  deviceId: z.number().int().positive("Vui lòng chọn thiết bị"),
  title: z.string().trim().min(3, "Tiêu đề cần ít nhất 3 ký tự").max(255),
  customerIssue: z.string().trim().min(3, "Mô tả cần ít nhất 3 ký tự").max(5000),
  repairAddress: z.string().trim().min(5, "Địa chỉ sửa chữa cần ít nhất 5 ký tự").max(500),
  initialCondition: nullableText(5000),
  accessoriesReceived: nullableText(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  expectedDiagnosisAt: z.string().optional(),
  expectedCompletionAt: z.string().optional(),
  receiveNow: z.boolean(),
}).superRefine((value, context) => {
  if (value.expectedDiagnosisAt && value.expectedCompletionAt) {
    if (new Date(value.expectedCompletionAt) <= new Date(value.expectedDiagnosisAt)) {
      context.addIssue({ code: "custom", path: ["expectedCompletionAt"], message: "Ngày hoàn thành phải sau ngày chẩn đoán" });
    }
  }
});

export type TicketValues = z.infer<typeof ticketSchema>;
