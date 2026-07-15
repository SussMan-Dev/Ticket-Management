import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { repairActionController } from "./repair-action.controller.js";
import {
  completeTestingSchema,
  createRepairLogSchema,
  createTestResultSchema,
  repairLogIdParamsSchema,
  ticketRepairActionParamsSchema,
  updateRepairLogSchema,
} from "./repair-action.schema.js";

export const ticketRepairActionRouter = Router();
export const repairLogRouter = Router();

ticketRepairActionRouter.get(
  "/:ticketId/repair-logs",
  authenticate,
  authorize("CUSTOMER", "TECHNICIAN", "MANAGER"),
  validate(ticketRepairActionParamsSchema),
  asyncHandler(repairActionController.listRepairLogs),
);
ticketRepairActionRouter.post(
  "/:ticketId/repair-logs",
  authenticate,
  authorize("TECHNICIAN"),
  validate(createRepairLogSchema),
  asyncHandler(repairActionController.createRepairLog),
);
ticketRepairActionRouter.get(
  "/:ticketId/test-results",
  authenticate,
  authorize("CUSTOMER", "TECHNICIAN", "MANAGER"),
  validate(ticketRepairActionParamsSchema),
  asyncHandler(repairActionController.listTestResults),
);
ticketRepairActionRouter.post(
  "/:ticketId/test-results",
  authenticate,
  authorize("TECHNICIAN"),
  validate(createTestResultSchema),
  asyncHandler(repairActionController.createTestResult),
);
ticketRepairActionRouter.post(
  "/:ticketId/complete-testing",
  authenticate,
  authorize("TECHNICIAN"),
  validate(completeTestingSchema),
  asyncHandler(repairActionController.completeTesting),
);
ticketRepairActionRouter.get(
  "/:ticketId/timeline",
  authenticate,
  authorize("CUSTOMER", "TECHNICIAN", "RECEPTIONIST", "MANAGER"),
  validate(ticketRepairActionParamsSchema),
  asyncHandler(repairActionController.getTimeline),
);

repairLogRouter.patch(
  "/:id",
  authenticate,
  authorize("TECHNICIAN"),
  validate(updateRepairLogSchema),
  asyncHandler(repairActionController.updateRepairLog),
);
