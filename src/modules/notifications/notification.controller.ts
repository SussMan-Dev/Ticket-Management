import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/unauthorized-error.js";
import { createPaginationMeta } from "../../common/utils/pagination.util.js";
import { sendSuccess } from "../../common/utils/response.util.js";
import type { ListNotificationsQuery } from "./notification.dto.js";
import type {
  ListNotificationsQueryInput,
  NotificationIdParams,
} from "./notification.schema.js";
import { notificationService } from "./notification.service.js";

function actor(request: Request): Express.AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError("Authentication is required", "AUTH_TOKEN_MISSING");
  }
  return request.user;
}

export const notificationController = {
  async list(request: Request, response: Response): Promise<Response> {
    const query = request.validated?.query as ListNotificationsQueryInput;
    const result = await notificationService.list(
      actor(request),
      query as ListNotificationsQuery,
    );
    return sendSuccess(response, {
      message: "Lấy danh sách thông báo thành công",
      data: result.notifications,
      meta: createPaginationMeta(query.page, query.limit, result.total),
    });
  },

  async unreadCount(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, {
      message: "Lấy số thông báo chưa đọc thành công",
      data: { count: await notificationService.unreadCount(actor(request)) },
    });
  },

  async markRead(request: Request, response: Response): Promise<Response> {
    const { id } = request.validated?.params as NotificationIdParams;
    return sendSuccess(response, {
      message: "Đã đánh dấu thông báo là đã đọc",
      data: await notificationService.markRead(actor(request), id),
    });
  },

  async markAllRead(request: Request, response: Response): Promise<Response> {
    return sendSuccess(response, {
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
      data: { updated: await notificationService.markAllRead(actor(request)) },
    });
  },
};
