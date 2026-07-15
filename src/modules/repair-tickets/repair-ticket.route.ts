import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { repairTicketController } from "./repair-ticket.controller.js";
import {
  cancelRepairTicketSchema,
  changeTicketStatusSchema,
  createRepairTicketSchema,
  createTicketAttachmentSchema,
  listRepairTicketsSchema,
  receiveRepairTicketSchema,
  repairTicketIdParamsSchema,
  updateRepairTicketSchema,
} from "./repair-ticket.schema.js";

export const repairTicketRouter = Router();

repairTicketRouter.use(authenticate);
repairTicketRouter.get(
  "/",
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER", "CASHIER"),
  validate(listRepairTicketsSchema),
  asyncHandler(repairTicketController.list),
);
repairTicketRouter.post(
  "/",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(createRepairTicketSchema),
  asyncHandler(repairTicketController.create),
);
repairTicketRouter.get(
  "/:id/status-history",
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"),
  validate(repairTicketIdParamsSchema),
  asyncHandler(repairTicketController.getStatusHistory),
);
repairTicketRouter.get(
  "/:id/attachments",
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"),
  validate(repairTicketIdParamsSchema),
  asyncHandler(repairTicketController.listAttachments),
);
repairTicketRouter.post(
  "/:id/attachments",
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"),
  validate(createTicketAttachmentSchema),
  asyncHandler(repairTicketController.createAttachment),
);
repairTicketRouter.post(
  "/:id/receive",
  authorize("RECEPTIONIST"),
  validate(receiveRepairTicketSchema),
  asyncHandler(repairTicketController.receive),
);
repairTicketRouter.post(
  "/:id/change-status",
  authorize("MANAGER"),
  validate(changeTicketStatusSchema),
  asyncHandler(repairTicketController.changeStatus),
);
repairTicketRouter.post(
  "/:id/cancel",
  authorize("CUSTOMER", "MANAGER"),
  validate(cancelRepairTicketSchema),
  asyncHandler(repairTicketController.cancel),
);
repairTicketRouter.get(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"),
  validate(repairTicketIdParamsSchema),
  asyncHandler(repairTicketController.getById),
);
repairTicketRouter.patch(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(updateRepairTicketSchema),
  asyncHandler(repairTicketController.update),
);
