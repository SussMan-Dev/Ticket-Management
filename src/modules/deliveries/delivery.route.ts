import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { deliveryController } from "./delivery.controller.js";
import { closeDeliverySchema, createDeliverySchema, ticketDeliveryParamsSchema } from "./delivery.schema.js";

export const ticketDeliveryRouter = Router();

ticketDeliveryRouter.get(
  "/:ticketId/delivery",
  authenticate,
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(ticketDeliveryParamsSchema),
  asyncHandler(deliveryController.get),
);
ticketDeliveryRouter.post(
  "/:ticketId/close",
  authenticate,
  authorize("RECEPTIONIST", "MANAGER"),
  validate(closeDeliverySchema),
  asyncHandler(deliveryController.close),
);
ticketDeliveryRouter.post(
  "/:ticketId/deliver",
  authenticate,
  authorize("RECEPTIONIST", "MANAGER"),
  validate(createDeliverySchema),
  asyncHandler(deliveryController.deliver),
);
