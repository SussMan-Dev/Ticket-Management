import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  CreateQuotationBody,
  QuotationActionBody,
  QuotationIdParams,
  QuotationResponseBody,
  TicketQuotationParams,
  UpdateQuotationBody,
} from "./quotation.schema.js";
import { quotationService } from "./quotation.service.js";

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

async function managerAction(
  request: Request,
  response: Response,
  action: "submit" | "approve" | "send",
  message: string,
): Promise<Response> {
  const { id } = request.validated?.params as QuotationIdParams;
  const { reason } = request.validated?.body as QuotationActionBody;
  const quotation = await quotationService[action](
    authenticatedUser(request),
    id,
    reason,
    metadata(request),
  );
  return sendSuccess(response, { message, data: quotation });
}

async function customerAction(
  request: Request,
  response: Response,
  action: "accept" | "reject",
  message: string,
): Promise<Response> {
  const { id } = request.validated?.params as QuotationIdParams;
  const { note } = request.validated?.body as QuotationResponseBody;
  const quotation = await quotationService[action](
    authenticatedUser(request),
    id,
    note,
    metadata(request),
  );
  return sendSuccess(response, { message, data: quotation });
}

export const quotationController = {
  async list(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketQuotationParams;
    const quotations = await quotationService.list(
      authenticatedUser(request),
      ticketId,
    );
    return sendSuccess(response, {
      message: "Quotations retrieved successfully",
      data: quotations,
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as QuotationIdParams;
    const quotation = await quotationService.getById(authenticatedUser(request), id);
    return sendSuccess(response, {
      message: "Quotation retrieved successfully",
      data: quotation,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketQuotationParams;
    const body = request.validated?.body as CreateQuotationBody;
    const quotation = await quotationService.create(
      authenticatedUser(request),
      ticketId,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Quotation created successfully",
      data: quotation,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as QuotationIdParams;
    const body = request.validated?.body as UpdateQuotationBody;
    const quotation = await quotationService.update(
      authenticatedUser(request),
      id,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Quotation updated successfully",
      data: quotation,
    });
  },

  async submit(request: Request, response: Response): Promise<Response> {
    return managerAction(request, response, "submit", "Quotation submitted successfully");
  },

  async approve(request: Request, response: Response): Promise<Response> {
    return managerAction(request, response, "approve", "Quotation approved successfully");
  },

  async send(request: Request, response: Response): Promise<Response> {
    return managerAction(request, response, "send", "Quotation sent successfully");
  },

  async accept(request: Request, response: Response): Promise<Response> {
    return customerAction(request, response, "accept", "Quotation accepted successfully");
  },

  async reject(request: Request, response: Response): Promise<Response> {
    return customerAction(request, response, "reject", "Quotation rejected successfully");
  },
};
