import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { ticketAssignmentController } from "./ticket-assignment.controller.js";
import {
  assignTicketSchema,
  reassignTicketSchema,
} from "./ticket-assignment.schema.js";

export const ticketAssignmentRouter = Router();

ticketAssignmentRouter.post(
  "/:ticketId/assign",
  authenticate,
  authorize("MANAGER"),
  validate(assignTicketSchema),
  asyncHandler(ticketAssignmentController.assign),
);
ticketAssignmentRouter.post(
  "/:ticketId/reassign",
  authenticate,
  authorize("MANAGER"),
  validate(reassignTicketSchema),
  asyncHandler(ticketAssignmentController.reassign),
);
