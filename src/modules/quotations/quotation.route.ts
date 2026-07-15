import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { quotationController } from "./quotation.controller.js";
import {
  createQuotationSchema,
  quotationActionSchema,
  quotationIdParamsSchema,
  quotationResponseSchema,
  ticketQuotationParamsSchema,
  updateQuotationSchema,
} from "./quotation.schema.js";

export const ticketQuotationRouter = Router();
export const quotationRouter = Router();

ticketQuotationRouter.get(
  "/:ticketId/quotations",
  authenticate,
  authorize("CUSTOMER", "TECHNICIAN", "MANAGER"),
  validate(ticketQuotationParamsSchema),
  asyncHandler(quotationController.list),
);
ticketQuotationRouter.post(
  "/:ticketId/quotations",
  authenticate,
  authorize("MANAGER"),
  validate(createQuotationSchema),
  asyncHandler(quotationController.create),
);

quotationRouter.use(authenticate);
quotationRouter.get(
  "/:id",
  authorize("CUSTOMER", "TECHNICIAN", "MANAGER"),
  validate(quotationIdParamsSchema),
  asyncHandler(quotationController.getById),
);
quotationRouter.patch(
  "/:id",
  authorize("MANAGER"),
  validate(updateQuotationSchema),
  asyncHandler(quotationController.update),
);
quotationRouter.post(
  "/:id/submit",
  authorize("MANAGER"),
  validate(quotationActionSchema),
  asyncHandler(quotationController.submit),
);
quotationRouter.post(
  "/:id/approve",
  authorize("MANAGER"),
  validate(quotationActionSchema),
  asyncHandler(quotationController.approve),
);
quotationRouter.post(
  "/:id/send",
  authorize("MANAGER"),
  validate(quotationActionSchema),
  asyncHandler(quotationController.send),
);
quotationRouter.post(
  "/:id/accept",
  authorize("CUSTOMER"),
  validate(quotationResponseSchema),
  asyncHandler(quotationController.accept),
);
quotationRouter.post(
  "/:id/reject",
  authorize("CUSTOMER"),
  validate(quotationResponseSchema),
  asyncHandler(quotationController.reject),
);

