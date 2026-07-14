import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { deviceController } from "./device.controller.js";
import {
  catalogListSchema,
  createDeviceSchema,
  deviceIdParamsSchema,
  listDevicesSchema,
  updateDeviceSchema,
} from "./device.schema.js";

export const deviceRouter = Router();

deviceRouter.use(authenticate);
deviceRouter.get(
  "/categories",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(catalogListSchema),
  asyncHandler(deviceController.listCategories),
);
deviceRouter.get(
  "/brands",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(catalogListSchema),
  asyncHandler(deviceController.listBrands),
);
deviceRouter.get(
  "/",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(listDevicesSchema),
  asyncHandler(deviceController.list),
);
deviceRouter.post(
  "/",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(createDeviceSchema),
  asyncHandler(deviceController.create),
);
deviceRouter.get(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(deviceIdParamsSchema),
  asyncHandler(deviceController.getById),
);
deviceRouter.patch(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(updateDeviceSchema),
  asyncHandler(deviceController.update),
);
deviceRouter.delete(
  "/:id",
  authorize("CUSTOMER", "RECEPTIONIST", "MANAGER"),
  validate(deviceIdParamsSchema),
  asyncHandler(deviceController.delete),
);
