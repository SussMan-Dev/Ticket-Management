import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/database.js";
import type { ListNotificationsQuery } from "./notification.dto.js";
import type { NotificationRow } from "./notification.model.js";

type DatabaseExecutor = Pool | PoolConnection;

interface CountRow extends RowDataPacket {
  total: number;
}

export interface NotificationListRowsResult {
  rows: NotificationRow[];
  total: number;
}

const notificationColumns = `
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.content,
  n.reference_type,
  n.reference_id,
  n.is_read,
  n.read_at,
  n.created_at
`;

export class NotificationRepository {
  public async list(
    userId: number,
    query: ListNotificationsQuery,
  ): Promise<NotificationListRowsResult> {
    const conditions = ["n.user_id = ?"];
    const params: Array<number | boolean> = [userId];
    if (query.isRead !== undefined) {
      conditions.push("n.is_read = ?");
      params.push(query.isRead);
    }
    const where = conditions.join(" AND ");
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.query<NotificationRow[]>(
      `
        SELECT ${notificationColumns}
        FROM notifications AS n
        WHERE ${where}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(n.id) AS total FROM notifications AS n WHERE ${where}`,
      params,
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findOwnedById(
    executor: DatabaseExecutor,
    notificationId: number,
    userId: number,
  ): Promise<NotificationRow | null> {
    const [rows] = await executor.execute<NotificationRow[]>(
      `
        SELECT ${notificationColumns}
        FROM notifications AS n
        WHERE n.id = ? AND n.user_id = ?
        LIMIT 1
      `,
      [notificationId, userId],
    );
    return rows[0] ?? null;
  }

  public async countUnread(
    executor: DatabaseExecutor,
    userId: number,
  ): Promise<number> {
    const [rows] = await executor.execute<CountRow[]>(
      `
        SELECT COUNT(n.id) AS total
        FROM notifications AS n
        WHERE n.user_id = ? AND n.is_read = FALSE
      `,
      [userId],
    );
    return rows[0]?.total ?? 0;
  }

  public async markRead(
    executor: DatabaseExecutor,
    notificationId: number,
    userId: number,
  ): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `
        UPDATE notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ? AND user_id = ?
      `,
      [notificationId, userId],
    );
  }

  public async markAllRead(
    executor: DatabaseExecutor,
    userId: number,
  ): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_read = FALSE
      `,
      [userId],
    );
    return result.affectedRows;
  }
}

export const notificationRepository = new NotificationRepository();

