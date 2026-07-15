import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { CloseDeliveryBody, CreateDeliveryBody, TicketDeliveryParams } from "./delivery.schema.js";
import { deliveryService } from "./delivery.service.js";

function actor(request: Request): Express.AuthenticatedUser {
  if (!request.user) throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  return request.user;
}

function metadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

export const deliveryController = {
  async get(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketDeliveryParams;
    return sendSuccess(response, {
      message: "Delivery retrieved successfully",
      data: await deliveryService.get(actor(request), ticketId),
    });
  },

  async deliver(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketDeliveryParams;
    return sendSuccess(response, {
      statusCode: 201,
      message: "Device delivered successfully",
      data: await deliveryService.deliver(
        actor(request),
        ticketId,
        request.validated?.body as CreateDeliveryBody,
        metadata(request),
      ),
    });
  },

  async close(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketDeliveryParams;
    return sendSuccess(response, {
      message: "Repair ticket closed successfully",
      data: await deliveryService.close(
        actor(request), ticketId, request.validated?.body as CloseDeliveryBody,
        metadata(request),
      ),
    });
  },
};
