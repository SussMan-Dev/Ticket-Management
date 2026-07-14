import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { ListDevicesQuery } from "./device.dto.js";
import type {
  CreateDeviceBody,
  DeviceIdParams,
  ListDevicesQueryInput,
  UpdateDeviceBody,
} from "./device.schema.js";
import { deviceService } from "./device.service.js";

function authenticatedUser(request: Request): Express.AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  }

  return request.user;
}

export const deviceController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListDevicesQueryInput;
    const result = await deviceService.list(
      authenticatedUser(request),
      query as ListDevicesQuery,
    );
    return sendSuccess(response, {
      message: "Devices retrieved successfully",
      data: result.devices,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async getById(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DeviceIdParams;
    const device = await deviceService.getById(authenticatedUser(request), id);
    return sendSuccess(response, {
      message: "Device retrieved successfully",
      data: device,
    });
  },

  async create(request: Request, response: Response): Promise<Response> {
    const body = request.validated?.body as CreateDeviceBody;
    const device = await deviceService.create(authenticatedUser(request), body);
    return sendSuccess(response, {
      statusCode: 201,
      message: "Device created successfully",
      data: device,
    });
  },

  async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DeviceIdParams;
    const body = request.validated?.body as UpdateDeviceBody;
    const device = await deviceService.update(authenticatedUser(request), id, body);
    return sendSuccess(response, {
      message: "Device updated successfully",
      data: device,
    });
  },

  async delete(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as DeviceIdParams;
    await deviceService.delete(authenticatedUser(request), id);
    return sendSuccess(response, {
      message: "Device deleted successfully",
      data: null,
    });
  },

  async listCategories(_request: Request, response: Response): Promise<Response> {
    const categories = await deviceService.listCategories();
    return sendSuccess(response, {
      message: "Device categories retrieved successfully",
      data: categories,
    });
  },

  async listBrands(_request: Request, response: Response): Promise<Response> {
    const brands = await deviceService.listBrands();
    return sendSuccess(response, {
      message: "Device brands retrieved successfully",
      data: brands,
    });
  },
};
