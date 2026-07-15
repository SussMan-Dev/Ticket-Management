import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { ListRepairTicketsQuery } from "./repair-ticket.dto.js";
import type {
  CancelRepairTicketBody,
  ChangeTicketStatusBody,
  CreateRepairTicketBody,
  CreateTicketAttachmentBody,
  ListRepairTicketsQueryInput,
  ReceiveRepairTicketBody,
  RepairTicketIdParams,
  UpdateRepairTicketBody,
  UploadTicketAttachmentQuery,
} from "./repair-ticket.schema.js";
import { repairTicketService } from "./repair-ticket.service.js";

function authenticatedUser(request: Request): Express.AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  }

  return request.user;
}

export const repairTicketController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListRepairTicketsQueryInput;
    const result = await repairTicketService.list(
      authenticatedUser(request),
      query as ListRepairTicketsQuery,
    );
    return sendSuccess(response, {
      message: "Repair tickets retrieved successfully",
      data: result.tickets,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const ticket = await repairTicketService.getById(authenticatedUser(request), id);
    return sendSuccess(response, {
      message: "Repair ticket retrieved successfully",
      data: ticket,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as CreateRepairTicketBody;
    const ticket = await repairTicketService.create(authenticatedUser(request), body);
    return sendSuccess(response, {
      statusCode: 201,
      message: "Repair ticket created successfully",
      data: ticket,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const body = request.validated?.body as UpdateRepairTicketBody;
    const ticket = await repairTicketService.update(
      authenticatedUser(request),
      id,
      body,
    );
    return sendSuccess(response, {
      message: "Repair ticket updated successfully",
      data: ticket,
    });
  },

  async receive(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const { reason } = request.validated?.body as ReceiveRepairTicketBody;
    const ticket = await repairTicketService.receive(
      authenticatedUser(request),
      id,
      reason,
    );
    return sendSuccess(response, {
      message: "Repair ticket received successfully",
      data: ticket,
    });
  },

  async changeStatus(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const { status, reason } = request.validated?.body as ChangeTicketStatusBody;
    const ticket = await repairTicketService.changeStatus(
      authenticatedUser(request),
      id,
      status,
      reason,
    );
    return sendSuccess(response, {
      message: "Repair ticket status updated successfully",
      data: ticket,
    });
  },

  async cancel(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const { reason } = request.validated?.body as CancelRepairTicketBody;
    const ticket = await repairTicketService.cancel(
      authenticatedUser(request),
      id,
      reason,
    );
    return sendSuccess(response, {
      message: "Repair ticket cancelled successfully",
      data: ticket,
    });
  },

  async getStatusHistory(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const history = await repairTicketService.getStatusHistory(
      authenticatedUser(request),
      id,
    );
    return sendSuccess(response, {
      message: "Repair ticket status history retrieved successfully",
      data: history,
    });
  },

  async listAttachments(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const attachments = await repairTicketService.listAttachments(
      authenticatedUser(request),
      id,
    );
    return sendSuccess(response, {
      message: "Repair ticket attachments retrieved successfully",
      data: attachments,
    });
  },

  async createAttachment(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const body = request.validated?.body as CreateTicketAttachmentBody;
    const attachment = await repairTicketService.createAttachment(
      authenticatedUser(request),
      id,
      body,
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Repair ticket attachment created successfully",
      data: attachment,
    });
  },

  async createAttachmentFile(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as RepairTicketIdParams;
    const { attachmentType, fileName } = request.validated
      ?.query as UploadTicketAttachmentQuery;
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const attachment = await repairTicketService.createAttachmentFile(
      authenticatedUser(request),
      id,
      {
        attachmentType,
        fileName,
        bytes,
        mimeType: request.get("content-type") ?? "",
      },
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Repair ticket image uploaded successfully",
      data: attachment,
    });
  },
};
