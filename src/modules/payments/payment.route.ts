import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { paymentController } from "./payment.controller.js";
import {
  createPaymentSchema,
  invoiceIdParamsSchema,
  listInvoicesSchema,
  refundPaymentSchema,
  ticketInvoiceParamsSchema,
} from "./payment.schema.js";

export const invoiceRouter = Router();
export const paymentRouter = Router();
export const ticketInvoiceRouter = Router();

ticketInvoiceRouter.get(
  "/:ticketId/invoice-preview",
  authenticate,
  authorize("CASHIER"),
  validate(ticketInvoiceParamsSchema),
  asyncHandler(paymentController.previewInvoice),
);

invoiceRouter.get(
  "/",
  authenticate,
  authorize("CUSTOMER", "CASHIER", "MANAGER"),
  validate(listInvoicesSchema),
  asyncHandler(paymentController.listInvoices),
);
invoiceRouter.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER", "CASHIER", "MANAGER"),
  validate(invoiceIdParamsSchema),
  asyncHandler(paymentController.getInvoice),
);
invoiceRouter.get(
  "/:id/payments",
  authenticate,
  authorize("CUSTOMER", "CASHIER", "MANAGER"),
  validate(invoiceIdParamsSchema),
  asyncHandler(paymentController.listPayments),
);
invoiceRouter.post(
  "/:id/payments",
  authenticate,
  authorize("CASHIER"),
  validate(createPaymentSchema),
  asyncHandler(paymentController.createPayment),
);

paymentRouter.get(
  "/refund-approvers",
  authenticate,
  authorize("CASHIER"),
  asyncHandler(paymentController.listRefundApprovers),
);
paymentRouter.post(
  "/:id/refund",
  authenticate,
  authorize("CASHIER"),
  validate(refundPaymentSchema),
  asyncHandler(paymentController.refundPayment),
);

ticketInvoiceRouter.post(
  "/:ticketId/invoices",
  authenticate,
  authorize("CASHIER"),
  validate(ticketInvoiceParamsSchema),
  asyncHandler(paymentController.createInvoice),
);
