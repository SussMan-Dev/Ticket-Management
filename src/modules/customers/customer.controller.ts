import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  ListCustomerDevicesQueryInput,
} from "../devices/device.schema.js";
import { deviceService } from "../devices/device.service.js";
import type { ListCustomerTicketsQueryInput } from "../repair-tickets/repair-ticket.schema.js";
import { repairTicketService } from "../repair-tickets/repair-ticket.service.js";
import type { ListCustomersQuery } from "./customer.dto.js";
import type {
  CreateCustomerBody,
  CustomerIdParams,
  ListCustomersQueryInput,
  UpdateCustomerBody,
} from "./customer.schema.js";
import { customerService } from "./customer.service.js";

function metadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

function authenticatedUser(request: Request): Express.AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  }

  return request.user;
}

export const customerController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListCustomersQueryInput;
    const result = await customerService.list(query as ListCustomersQuery);
    return sendSuccess(response, {
      message: "Customers retrieved successfully",
      data: result.customers,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as CustomerIdParams;
    const customer = await customerService.getById(authenticatedUser(request), id);
    return sendSuccess(response, {
      message: "Customer retrieved successfully",
      data: customer,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as CreateCustomerBody;
    const customer = await customerService.create(
      authenticatedUser(request),
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Customer created successfully",
      data: customer,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as CustomerIdParams;
    const body = request.validated?.body as UpdateCustomerBody;
    const customer = await customerService.update(
      authenticatedUser(request),
      id,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Customer updated successfully",
      data: customer,
    });
  },

  async listDevices(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as CustomerIdParams;
    const query = request.validated?.query as ListCustomerDevicesQueryInput;
    const result = await deviceService.listForCustomer(
      authenticatedUser(request),
      id,
      query,
    );
    return sendSuccess(response, {
      message: "Customer devices retrieved successfully",
      data: result.devices,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async listTickets(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as CustomerIdParams;
    const query = request.validated?.query as ListCustomerTicketsQueryInput;
    const result = await repairTicketService.listForCustomer(
      authenticatedUser(request),
      id,
      query,
    );
    return sendSuccess(response, {
      message: "Customer repair tickets retrieved successfully",
      data: result.tickets,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },
};
