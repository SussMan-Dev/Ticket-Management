import express, { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { env } from "../../config/env.js";
import { userController } from "./user.controller.js";
import {
  createStaffSchema,
  listUsersSchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
} from "./user.schema.js";

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get(
  "/",
  authorize("ADMIN"),
  validate(listUsersSchema),
  asyncHandler(userController.list),
);
userRouter.get(
  "/:id",
  authorize("ADMIN"),
  validate(userIdParamsSchema),
  asyncHandler(userController.getById),
);
userRouter.post(
  "/",
  authorize("ADMIN"),
  validate(createStaffSchema),
  asyncHandler(userController.create),
);
userRouter.patch(
  "/:id",
  validate(updateUserSchema),
  asyncHandler(userController.update),
);
userRouter.post(
  "/:id/avatar",
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: env.IMAGE_UPLOAD_MAX_BYTES,
  }),
  validate(userIdParamsSchema),
  asyncHandler(userController.updateAvatar),
);
userRouter.patch(
  "/:id/status",
  authorize("ADMIN"),
  validate(updateUserStatusSchema),
  asyncHandler(userController.updateStatus),
);
userRouter.patch(
  "/:id/role",
  authorize("ADMIN"),
  validate(updateUserRoleSchema),
  asyncHandler(userController.updateRole),
);
