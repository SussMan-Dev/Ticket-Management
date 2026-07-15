import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { diagnosisController } from "./diagnosis.controller.js";
import {
  approveDiagnosisSchema,
  createDiagnosisSchema,
  requestDiagnosisRevisionSchema,
  submitDiagnosisSchema,
  ticketDiagnosisParamsSchema,
  updateDiagnosisSchema,
} from "./diagnosis.schema.js";

export const ticketDiagnosisRouter = Router();
export const diagnosisRouter = Router();

ticketDiagnosisRouter.get(
  "/:ticketId/diagnoses",
  authenticate,
  authorize("CUSTOMER", "TECHNICIAN", "MANAGER"),
  validate(ticketDiagnosisParamsSchema),
  asyncHandler(diagnosisController.list),
);
ticketDiagnosisRouter.post(
  "/:ticketId/diagnoses",
  authenticate,
  authorize("TECHNICIAN"),
  validate(createDiagnosisSchema),
  asyncHandler(diagnosisController.create),
);

diagnosisRouter.use(authenticate);
diagnosisRouter.patch(
  "/:id",
  authorize("TECHNICIAN"),
  validate(updateDiagnosisSchema),
  asyncHandler(diagnosisController.update),
);
diagnosisRouter.post(
  "/:id/submit",
  authorize("TECHNICIAN"),
  validate(submitDiagnosisSchema),
  asyncHandler(diagnosisController.submit),
);
diagnosisRouter.post(
  "/:id/request-revision",
  authorize("MANAGER"),
  validate(requestDiagnosisRevisionSchema),
  asyncHandler(diagnosisController.requestRevision),
);
diagnosisRouter.post(
  "/:id/approve",
  authorize("MANAGER"),
  validate(approveDiagnosisSchema),
  asyncHandler(diagnosisController.approve),
);
