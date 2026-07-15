import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  CompleteTestingBody,
  CreateRepairLogBody,
  CreateTestResultBody,
  RepairLogIdParams,
  TicketRepairActionParams,
  UpdateRepairLogBody,
} from "./repair-action.schema.js";
import { repairActionService } from "./repair-action.service.js";

function actor(request: Request): Express.AuthenticatedUser {
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

export const repairActionController = {
  async listRepairLogs(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const logs = await repairActionService.listRepairLogs(actor(request), ticketId);
    return sendSuccess(response, {
      message: "Repair logs retrieved successfully",
      data: logs,
    });
  },

  async createRepairLog(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const log = await repairActionService.createRepairLog(
      actor(request),
      ticketId,
      request.validated?.body as CreateRepairLogBody,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Repair log created successfully",
      data: log,
    });
  },

  async updateRepairLog(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairLogIdParams;
    const log = await repairActionService.updateRepairLog(
      actor(request),
      id,
      request.validated?.body as UpdateRepairLogBody,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Repair log updated successfully",
      data: log,
    });
  },

  async listTestResults(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const results = await repairActionService.listTestResults(actor(request), ticketId);
    return sendSuccess(response, {
      message: "Test results retrieved successfully",
      data: results,
    });
  },

  async createTestResult(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const result = await repairActionService.createTestResult(
      actor(request),
      ticketId,
      request.validated?.body as CreateTestResultBody,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Test result recorded successfully",
      data: result,
    });
  },

  async completeTesting(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const result = await repairActionService.completeTesting(
      actor(request),
      ticketId,
      request.validated?.body as CompleteTestingBody,
      metadata(request),
    );
    return sendSuccess(response, {
      message: result.outcome === "COMPLETED"
        ? "Testing completed successfully"
        : "Testing completed with additional repair required",
      data: result,
    });
  },

  async getTimeline(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketRepairActionParams;
    const timeline = await repairActionService.getTimeline(actor(request), ticketId);
    return sendSuccess(response, {
      message: "Repair ticket timeline retrieved successfully",
      data: timeline,
    });
  },
};
