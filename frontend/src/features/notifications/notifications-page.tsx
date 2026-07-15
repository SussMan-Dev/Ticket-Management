import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { formatDateTime } from "../../lib/formatting/formatters";
import type { Notification } from "../../types/domain";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "./notifications.api";

function referencePath(notification: Notification): string | null {
  if (notification.reference?.type === "REPAIR_TICKET") return `/tickets/${notification.reference.id}`;
  if (notification.reference?.type === "INVOICE") return `/invoices/${notification.reference.id}`;
  return null;
}

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const notifications = useNotifications({ page, limit: 15, isRead: filter === "unread" ? false : undefined });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const rows = notifications.data?.data ?? [];
  return <><PageHeader eyebrow="Trung tâm cập nhật" title="Thông báo" description="Theo dõi các thay đổi quan trọng từ chẩn đoán, báo giá, thanh toán đến bàn giao." actions={<Button variant="secondary" size="sm" disabled={!rows.some((item) => !item.isRead)} loading={markAll.isPending} onClick={() => markAll.mutate()}>Đánh dấu tất cả đã đọc</Button>} /><Card><div className="filter-row"><button className={filter === "all" ? "filter-chip filter-chip--active" : "filter-chip"} onClick={() => { setFilter("all"); setPage(1); }}>Tất cả</button><button className={filter === "unread" ? "filter-chip filter-chip--active" : "filter-chip"} onClick={() => { setFilter("unread"); setPage(1); }}>Chưa đọc</button></div>{notifications.isLoading ? <LoadingState rows={5} /> : notifications.isError ? <ErrorState error={notifications.error} retry={() => void notifications.refetch()} /> : rows.length === 0 ? <EmptyState title="Không có thông báo" description={filter === "unread" ? "Bạn đã đọc tất cả cập nhật." : "Các cập nhật nghiệp vụ sẽ xuất hiện tại đây."} /> : <div className="notification-list">{rows.map((item) => { const path = referencePath(item); return <article className={item.isRead ? "notification-item" : "notification-item notification-item--unread"} key={item.id}><i aria-hidden="true" /><div><div className="notification-item__title"><strong>{item.title}</strong><time>{formatDateTime(item.createdAt)}</time></div><p>{item.content}</p><div className="button-row">{path ? <Link className="text-link" to={path} onClick={() => { if (!item.isRead) markRead.mutate(item.id); }}>Xem chi tiết →</Link> : null}{!item.isRead ? <button className="text-button" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>Đánh dấu đã đọc</button> : null}</div></div></article>; })}</div>}<Pagination page={page} totalPages={notifications.data?.meta.totalPages ?? 1} onChange={setPage} /><MutationError error={markRead.error ?? markAll.error} /></Card></>;
}
