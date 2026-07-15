import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { inventoryController } from "./inventory.controller.js";
import {
  approvePartRequestSchema,
  createPartRequestSchema,
  fulfillPartRequestSchema,
  listPartRequestsSchema,
  partRequestIdParamsSchema,
  rejectPartRequestSchema,
} from "./inventory.schema.js";

export const ticketPartRequestRouter = Router();
export const partRequestRouter = Router();

ticketPartRequestRouter.post(
  "/:ticketId/part-requests",
  authenticate,
  authorize("TECHNICIAN"),
  validate(createPartRequestSchema),
  asyncHandler(inventoryController.create),
);

partRequestRouter.use(authenticate);
partRequestRouter.get(
  "/",
  authorize("TECHNICIAN", "INVENTORY_STAFF", "MANAGER"),
  validate(listPartRequestsSchema),
  asyncHandler(inventoryController.list),
);
partRequestRouter.get(
  "/:id",
  authorize("TECHNICIAN", "INVENTORY_STAFF", "MANAGER"),
  validate(partRequestIdParamsSchema),
  asyncHandler(inventoryController.getById),
);
partRequestRouter.post(
  "/:id/approve",
  authorize("INVENTORY_STAFF"),
  validate(approvePartRequestSchema),
  asyncHandler(inventoryController.approve),
);
partRequestRouter.post(
  "/:id/fulfill",
  authorize("INVENTORY_STAFF"),
  validate(fulfillPartRequestSchema),
  asyncHandler(inventoryController.fulfill),
);
partRequestRouter.post(
  "/:id/reject",
  authorize("INVENTORY_STAFF"),
  validate(rejectPartRequestSchema),
  asyncHandler(inventoryController.reject),
);

