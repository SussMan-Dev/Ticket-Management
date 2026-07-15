import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { partController } from "./part.controller.js";
import {
  adjustStockSchema,
  createPartSchema,
  listInventoryTransactionsSchema,
  listPartsSchema,
  partIdParamsSchema,
  stockInSchema,
  updatePartSchema,
} from "./part.schema.js";

export const partRouter = Router();

partRouter.use(authenticate);
partRouter.get(
  "/",
  authorize("TECHNICIAN", "INVENTORY_STAFF", "MANAGER"),
  validate(listPartsSchema),
  asyncHandler(partController.list),
);
partRouter.get(
  "/:id",
  authorize("TECHNICIAN", "INVENTORY_STAFF", "MANAGER"),
  validate(partIdParamsSchema),
  asyncHandler(partController.getById),
);
partRouter.post(
  "/",
  authorize("INVENTORY_STAFF"),
  validate(createPartSchema),
  asyncHandler(partController.create),
);
partRouter.patch(
  "/:id",
  authorize("INVENTORY_STAFF"),
  validate(updatePartSchema),
  asyncHandler(partController.update),
);
partRouter.post(
  "/:id/stock-in",
  authorize("INVENTORY_STAFF"),
  validate(stockInSchema),
  asyncHandler(partController.stockIn),
);
partRouter.post(
  "/:id/adjust-stock",
  authorize("INVENTORY_STAFF"),
  validate(adjustStockSchema),
  asyncHandler(partController.adjustStock),
);
partRouter.get(
  "/:id/transactions",
  authorize("INVENTORY_STAFF", "MANAGER"),
  validate(listInventoryTransactionsSchema),
  asyncHandler(partController.listTransactions),
);
