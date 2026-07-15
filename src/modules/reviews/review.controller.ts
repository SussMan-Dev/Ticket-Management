import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { CreateReviewBody, ReviewIdParams, TicketReviewParams, UpdateReviewBody } from "./review.schema.js";
import { reviewService } from "./review.service.js";

function actor(request: Request): Express.AuthenticatedUser {
  if (!request.user) throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  return request.user;
}

function metadata(request: Request): RequestMetadata {
  return { ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null };
}

export const reviewController = {
  async get(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketReviewParams;
    return sendSuccess(response, {
      message: "Review retrieved successfully",
      data: await reviewService.get(actor(request), ticketId),
    });
  },
  async create(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketReviewParams;
    return sendSuccess(response, {
      statusCode: 201,
      message: "Review created successfully",
      data: await reviewService.create(
        actor(request),
        ticketId,
        request.validated?.body as CreateReviewBody,
        metadata(request),
      ),
    });
  },
  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as ReviewIdParams;
    return sendSuccess(response, {
      message: "Review updated successfully",
      data: await reviewService.update(
        actor(request),
        id,
        request.validated?.body as UpdateReviewBody,
        metadata(request),
      ),
    });
  },
};

