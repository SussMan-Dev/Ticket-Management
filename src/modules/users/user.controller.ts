import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { ListUsersQuery } from "./user.dto.js";
import type {
  CreateStaffBody,
  ListUsersQueryInput,
  UpdateUserBody,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
  UserIdParams,
} from "./user.schema.js";
import { userService } from "./user.service.js";

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

export const userController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListUsersQueryInput;
    const result = await userService.list(query as ListUsersQuery);
    return sendSuccess(response, {
      message: "Users retrieved successfully",
      data: result.users,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as UserIdParams;
    const user = await userService.getById(id);
    return sendSuccess(response, {
      message: "User retrieved successfully",
      data: user,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as CreateStaffBody;
    const user = await userService.createStaff(
      authenticatedUser(request),
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      statusCode: 201,
      message: "Staff user created successfully",
      data: user,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as UserIdParams;
    const body = request.validated?.body as UpdateUserBody;
    const user = await userService.update(
      authenticatedUser(request),
      id,
      body,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "User updated successfully",
      data: user,
    });
  },

  async updateStatus(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as UserIdParams;
    const { status } = request.validated?.body as UpdateUserStatusBody;
    const user = await userService.updateStatus(
      authenticatedUser(request),
      id,
      status,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "User status updated successfully",
      data: user,
    });
  },

  async updateRole(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as UserIdParams;
    const { role } = request.validated?.body as UpdateUserRoleBody;
    const user = await userService.updateRole(
      authenticatedUser(request),
      id,
      role,
      metadata(request),
    );
    return sendSuccess(response, {
      message: "User role updated successfully",
      data: user,
    });
  },
};
