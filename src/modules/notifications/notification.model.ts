import type { RowDataPacket } from "mysql2";

export interface NotificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  reference_type: string | null;
  reference_id: number | null;
  is_read: number | boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  reference: { type: string; id: number } | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    reference: row.reference_type && row.reference_id
      ? { type: row.reference_type, id: row.reference_id }
      : null,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

