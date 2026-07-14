import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { listCustomerDevicesSchema } from "../devices/device.schema.js";
import { listCustomerTicketsSchema } from "../repair-tickets/repair-ticket.schema.js";
import { customerController } from "./customer.controller.js";
import {
  createCustomerSchema,
  customerIdParamsSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "./customer.schema.js";

export const customerRouter = Router();

customerRouter.use(authenticate);
customerRouter.get(
  "/",
  authorize("RECEPTIONIST", "MANAGER"),
  validate(listCustomersSchema),
  asyncHandler(customerController.list),
);
customerRouter.post(
  "/",
  authorize("RECEPTIONIST", "MANAGER"),
  validate(createCustomerSchema),
  asyncHandler(customerController.create),
);
customerRouter.get(
  "/:id/devices",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(listCustomerDevicesSchema),
  asyncHandler(customerController.listDevices),
);
customerRouter.get(
  "/:id/tickets",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(listCustomerTicketsSchema),
  asyncHandler(customerController.listTickets),
);
customerRouter.get(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(customerIdParamsSchema),
  asyncHandler(customerController.getById),
);
customerRouter.patch(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(updateCustomerSchema),
  asyncHandler(customerController.update),
);
