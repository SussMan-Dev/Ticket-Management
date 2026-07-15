import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { ListInvoicesQuery } from "./payment.dto.js";
import type {
  CreatePaymentBody,
  InvoiceIdParams,
  ListInvoicesQueryInput,
  PaymentIdParams,
  RefundPaymentBody,
  TicketInvoiceParams,
} from "./payment.schema.js";
import { paymentService } from "./payment.service.js";

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

export const paymentController = {
  async listRefundApprovers(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, {
      message: "Refund approvers retrieved successfully",
      data: await paymentService.listRefundApprovers(actor(request)),
    });
  },

  async listInvoices(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListInvoicesQueryInput;
    const result = await paymentService.listInvoices(
      actor(request),
      query as ListInvoicesQuery,
    );
    return sendSuccess(response, {
      message: "Invoices retrieved successfully",
      data: result.invoices,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getInvoice(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as InvoiceIdParams;
    return sendSuccess(response, {
      message: "Invoice retrieved successfully",
      data: await paymentService.getInvoice(actor(request), id),
    });
  },

  async createInvoice(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketInvoiceParams;
    return sendSuccess(response, {
      statusCode: 201,
      message: "Invoice created successfully",
      data: await paymentService.createInvoice(
        actor(request),
        ticketId,
        metadata(request),
      ),
    });
  },

  async listPayments(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as InvoiceIdParams;
    return sendSuccess(response, {
      message: "Payments retrieved successfully",
      data: await paymentService.listPayments(actor(request), id),
    });
  },

  async createPayment(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as InvoiceIdParams;
    return sendSuccess(response, {
      statusCode: 201,
      message: "Payment recorded successfully",
      data: await paymentService.createPayment(
        actor(request),
        id,
        request.validated?.body as CreatePaymentBody,
        metadata(request),
      ),
    });
  },

  async refundPayment(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as PaymentIdParams;
    return sendSuccess(response, {
      message: "Payment refunded successfully",
      data: await paymentService.refundPayment(
        actor(request),
        id,
        request.validated?.body as RefundPaymentBody,
        metadata(request),
      ),
    });
  },
};
