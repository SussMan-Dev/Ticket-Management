import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { ListPartRequestsQuery } from "./inventory.dto.js";
import type {
  ApprovePartRequestBody,
  CreatePartRequestBody,
  FulfillPartRequestBody,
  ListPartRequestsQueryInput,
  PartRequestIdParams,
  RejectPartRequestBody,
  TicketPartRequestParams,
} from "./inventory.schema.js";
import { inventoryService } from "./inventory.service.js";

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

export const inventoryController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListPartRequestsQueryInput;
    const result = await inventoryService.list(
      actor(request),
      query as ListPartRequestsQuery,
    );
    return sendSuccess(response, {
      message: "Part requests retrieved successfully",
      data: result.requests,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartRequestIdParams;
    const partRequest = await inventoryService.getById(actor(request), id);
    return sendSuccess(response, {
      message: "Part request retrieved successfully",
      data: partRequest,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketPartRequestParams;
    const partRequest = await inventoryService.create(
      actor(request),
      ticketId,
      request.validated?.body as CreatePartRequestBody,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Part request created successfully",
      data: partRequest,
    });
  },

  async approve(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartRequestIdParams;
    const { reason } = request.validated?.body as ApprovePartRequestBody;
    const partRequest = await inventoryService.approve(
      actor(request),
      id,
      reason,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Part request approved successfully",
      data: partRequest,
    });
  },

  async reject(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartRequestIdParams;
    const { reason } = request.validated?.body as RejectPartRequestBody;
    const partRequest = await inventoryService.reject(
      actor(request),
      id,
      reason,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Part request rejected successfully",
      data: partRequest,
    });
  },

  async fulfill(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartRequestIdParams;
    const partRequest = await inventoryService.fulfill(
      actor(request),
      id,
      request.validated?.body as FulfillPartRequestBody,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Part request fulfillment recorded successfully",
      data: partRequest,
    });
  },
};

