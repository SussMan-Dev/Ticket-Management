import { Router } from "express";
import { sendSuccess } from "../common/utils/response.util.js";
import { authRouter } from "../modules/auth/auth.route.js";
import { customerRouter } from "../modules/customers/customer.route.js";
import {
  diagnosisRouter,
  ticketDiagnosisRouter,
} from "../modules/diagnoses/diagnosis.route.js";
import { deviceRouter } from "../modules/devices/device.route.js";
import { ticketDeliveryRouter } from "../modules/deliveries/delivery.route.js";
import {
  partRequestRouter,
  ticketPartRequestRouter,
} from "../modules/inventory/inventory.route.js";
import { partRouter } from "../modules/parts/part.route.js";
import {
  invoiceRouter,
  paymentRouter,
  ticketInvoiceRouter,
} from "../modules/payments/payment.route.js";
import { notificationRouter } from "../modules/notifications/notification.route.js";
import {
  quotationRouter,
  ticketQuotationRouter,
} from "../modules/quotations/quotation.route.js";
import {
  repairLogRouter,
  ticketRepairActionRouter,
} from "../modules/repair-actions/repair-action.route.js";
import { repairTicketRouter } from "../modules/repair-tickets/repair-ticket.route.js";
import { reportRouter } from "../modules/reports/report.route.js";
import { reviewRouter, ticketReviewRouter } from "../modules/reviews/review.route.js";
import { ticketAssignmentRouter } from "../modules/ticket-assignments/ticket-assignment.route.js";
import { userRouter } from "../modules/users/user.route.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  return sendSuccess(response, {
    message: "Service is healthy",
    data: {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/devices", deviceRouter);
apiRouter.use("/parts", partRouter);
apiRouter.use("/part-requests", partRequestRouter);
apiRouter.use("/repair-tickets", ticketAssignmentRouter);
apiRouter.use("/repair-tickets", ticketDiagnosisRouter);
apiRouter.use("/repair-tickets", ticketQuotationRouter);
apiRouter.use("/repair-tickets", ticketPartRequestRouter);
apiRouter.use("/repair-tickets", ticketRepairActionRouter);
apiRouter.use("/repair-tickets", ticketInvoiceRouter);
apiRouter.use("/repair-tickets", ticketDeliveryRouter);
apiRouter.use("/repair-tickets", ticketReviewRouter);
apiRouter.use("/repair-tickets", repairTicketRouter);
apiRouter.use("/diagnoses", diagnosisRouter);
apiRouter.use("/quotations", quotationRouter);
apiRouter.use("/repair-logs", repairLogRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/reports", reportRouter);
