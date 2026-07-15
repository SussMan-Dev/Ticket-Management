import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { reportController } from "./report.controller.js";
import { reportDateRangeSchema, revenueReportSchema } from "./report.schema.js";

export const reportRouter = Router();

reportRouter.use(authenticate);
reportRouter.get("/dashboard", authorize("MANAGER"), asyncHandler(reportController.dashboard));
reportRouter.get("/tickets-by-status", authorize("MANAGER"), validate(reportDateRangeSchema), asyncHandler(reportController.ticketsByStatus));
reportRouter.get("/revenue", authorize("MANAGER"), validate(revenueReportSchema), asyncHandler(reportController.revenue));
reportRouter.get("/technician-performance", authorize("MANAGER"), validate(reportDateRangeSchema), asyncHandler(reportController.technicianPerformance));
reportRouter.get("/repair-time", authorize("MANAGER"), validate(reportDateRangeSchema), asyncHandler(reportController.repairTime));
reportRouter.get("/parts-usage", authorize("MANAGER", "INVENTORY_STAFF"), validate(reportDateRangeSchema), asyncHandler(reportController.partsUsage));
reportRouter.get("/low-stock", authorize("MANAGER", "INVENTORY_STAFF"), asyncHandler(reportController.lowStock));

