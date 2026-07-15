import { z } from "zod";

const positiveId = z.coerce.number().int().positive();

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isRead: z.enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }).strict(),
});

export const notificationIdParamsSchema = z.object({
  params: z.object({ id: positiveId }).strict(),
});

export type ListNotificationsQueryInput = z.infer<
  typeof listNotificationsSchema
>["query"];
export type NotificationIdParams = z.infer<
  typeof notificationIdParamsSchema
>["params"];

