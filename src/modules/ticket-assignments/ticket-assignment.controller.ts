import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  AssignTicketBody,
  ReassignTicketBody,
  TicketAssignmentParams,
} from "./ticket-assignment.schema.js";
import { ticketAssignmentService } from "./ticket-assignment.service.js";

function authenticatedUser(request: Request): Express.AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  }

  return request.user;
}

function metadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

export const ticketAssignmentController = {
  async assign(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketAssignmentParams;
    const body = request.validated?.body as AssignTicketBody;
    const assignment = await ticketAssignmentService.assign(
      authenticatedUser(request),
      ticketId,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Technician assigned successfully",
      data: assignment,
    });
  },

  async reassign(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketAssignmentParams;
    const body = request.validated?.body as ReassignTicketBody;
    const assignment = await ticketAssignmentService.reassign(
      authenticatedUser(request),
      ticketId,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Technician reassigned successfully",
      data: assignment,
    });
  },
};
