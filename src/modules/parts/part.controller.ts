import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  ListInventoryTransactionsQuery,
  ListPartsQuery,
} from "./part.dto.js";
import type {
  AdjustStockBody,
  CreatePartBody,
  ListInventoryTransactionsQueryInput,
  ListPartsQueryInput,
  PartIdParams,
  StockInBody,
  UpdatePartBody,
} from "./part.schema.js";
import { partService } from "./part.service.js";

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

export const partController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListPartsQueryInput;
    const result = await partService.list(actor(request), query as ListPartsQuery);
    return sendSuccess(response, {
      message: "Parts retrieved successfully",
      data: result.parts,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartIdParams;
    const part = await partService.getById(actor(request), id);
    return sendSuccess(response, { message: "Part retrieved successfully", data: part });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const part = await partService.create(
      actor(request),
      request.validated?.body as CreatePartBody,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Part created successfully",
      data: part,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartIdParams;
    const part = await partService.update(
      actor(request),
      id,
      request.validated?.body as UpdatePartBody,
      metadata(request),
    );
    return sendSuccess(response, { message: "Part updated successfully", data: part });
  },

  async stockIn(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartIdParams;
    const part = await partService.stockIn(
      actor(request),
      id,
      request.validated?.body as StockInBody,
      metadata(request),
    );
    return sendSuccess(response, { message: "Stock received successfully", data: part });
  },

  async adjustStock(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartIdParams;
    const part = await partService.adjustStock(
      actor(request),
      id,
      request.validated?.body as AdjustStockBody,
      metadata(request),
    );
    return sendSuccess(response, { message: "Stock adjusted successfully", data: part });
  },

  async listTransactions(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PartIdParams;
    const query = request.validated?.query as ListInventoryTransactionsQueryInput;
    const result = await partService.listTransactions(
      actor(request),
      id,
      query as ListInventoryTransactionsQuery,
    );
    return sendSuccess(response, {
      message: "Inventory transactions retrieved successfully",
      data: result.transactions,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },
};

