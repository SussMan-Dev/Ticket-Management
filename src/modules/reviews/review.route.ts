import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authenticate } from "../../middlewares/authentication.middleware.js";
import { authorize } from "../../middlewares/authorization.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { reviewController } from "./review.controller.js";
import { createReviewSchema, reviewIdParamsSchema, ticketReviewParamsSchema, updateReviewSchema } from "./review.schema.js";

export const ticketReviewRouter = Router();
export const reviewRouter = Router();

ticketReviewRouter.get(
  "/:ticketId/review",
  authenticate,
  authorize("CUSTOMER", "RECEPTIONIST", "TECHNICIAN", "MANAGER"),
  validate(ticketReviewParamsSchema),
  asyncHandler(reviewController.get),
);
ticketReviewRouter.post(
  "/:ticketId/review",
  authenticate,
  authorize("CUSTOMER"),
  validate(createReviewSchema),
  asyncHandler(reviewController.create),
);
reviewRouter.patch(
  "/:id",
  authenticate,
  authorize("CUSTOMER"),
  validate(updateReviewSchema),
  asyncHandler(reviewController.update),
);

