import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  ApproveDiagnosisBody,
  CreateDiagnosisBody,
  DiagnosisIdParams,
  RequestDiagnosisRevisionBody,
  SubmitDiagnosisBody,
  TicketDiagnosisParams,
  UpdateDiagnosisBody,
} from "./diagnosis.schema.js";
import { diagnosisService } from "./diagnosis.service.js";

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

export const diagnosisController = {
  async list(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketDiagnosisParams;
    const diagnoses = await diagnosisService.list(
      authenticatedUser(request),
      ticketId,
    );
    return sendSuccess(response, {
      message: "Diagnoses retrieved successfully",
      data: diagnoses,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const { ticketId } = request.validated?.params as TicketDiagnosisParams;
    const body = request.validated?.body as CreateDiagnosisBody;
    const diagnosis = await diagnosisService.create(
      authenticatedUser(request),
      ticketId,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Diagnosis created successfully",
      data: diagnosis,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DiagnosisIdParams;
    const body = request.validated?.body as UpdateDiagnosisBody;
    const diagnosis = await diagnosisService.update(
      authenticatedUser(request),
      id,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Diagnosis updated successfully",
      data: diagnosis,
    });
  },

  async submit(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DiagnosisIdParams;
    const { reason } = request.validated?.body as SubmitDiagnosisBody;
    const diagnosis = await diagnosisService.submit(
      authenticatedUser(request),
      id,
      reason,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Diagnosis submitted successfully",
      data: diagnosis,
    });
  },

  async requestRevision(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DiagnosisIdParams;
    const { reason } = request.validated?.body as RequestDiagnosisRevisionBody;
    const diagnosis = await diagnosisService.requestRevision(
      authenticatedUser(request),
      id,
      reason,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Diagnosis revision requested successfully",
      data: diagnosis,
    });
  },

  async approve(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DiagnosisIdParams;
    const { reason } = request.validated?.body as ApproveDiagnosisBody;
    const diagnosis = await diagnosisService.approve(
      authenticatedUser(request),
      id,
      reason,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "Diagnosis approved successfully",
      data: diagnosis,
    });
  },
};
