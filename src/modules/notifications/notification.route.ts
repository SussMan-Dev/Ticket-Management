import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { notificationController } from "./notification.controller.js";
import {
  listNotificationsSchema,
  notificationIdParamsSchema,
} from "./notification.schema.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get(
  "/",
  validate(listNotificationsSchema),
  asyncHandler(notificationController.list),
);
notificationRouter.get(
  "/unread-count",
  asyncHandler(notificationController.unreadCount),
);
notificationRouter.post(
  "/read-all",
  asyncHandler(notificationController.markAllRead),
);
notificationRouter.patch(
  "/:id/read",
  validate(notificationIdParamsSchema),
  asyncHandler(notificationController.markRead),
);
