import { NotFoundError } from "../../common/errors/not-found-error.js";
import { pool } from "../../config/database.js";
import type { ListNotificationsQuery } from "./notification.dto.js";
import { toNotification, type Notification } from "./notification.model.js";
import {
  notificationRepository,
  type NotificationRepository,
} from "./notification.repository.js";

export interface ListNotificationsResult {
  notifications: Notification[];
  total: number;
}

export class NotificationService {
  public constructor(
    private readonly repository: NotificationRepository = notificationRepository,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    query: ListNotificationsQuery,
  ): Promise<ListNotificationsResult> {
    const result = await this.repository.list(actor.id, query);
    return {
      notifications: result.rows.map(toNotification),
      total: result.total,
    };
  }

  public async unreadCount(actor: Express.AuthenticatedUser): Promise<number> {
    return this.repository.countUnread(pool, actor.id);
  }

  public async markRead(
    actor: Express.AuthenticatedUser,
    notificationId: number,
  ): Promise<Notification> {
    const current = await this.repository.findOwnedById(
      pool,
      notificationId,
      actor.id,
    );
    if (!current) {
      throw new NotFoundError("Không tìm thấy thông báo", "NOTIFICATION_NOT_FOUND");
    }
    if (!current.is_read) {
      await this.repository.markRead(pool, notificationId, actor.id);
    }
    const updated = await this.repository.findOwnedById(
      pool,
      notificationId,
      actor.id,
    );
    if (!updated) {
      throw new NotFoundError("Không tìm thấy thông báo", "NOTIFICATION_NOT_FOUND");
    }
    return toNotification(updated);
  }

  public async markAllRead(actor: Express.AuthenticatedUser): Promise<number> {
    return this.repository.markAllRead(pool, actor.id);
  }
}

export const notificationService = new NotificationService();
