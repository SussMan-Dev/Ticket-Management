import { Link } from "react-router-dom";
import { useUnreadNotificationCount } from "./notifications.api";

export function NotificationBell() {
  const unread = useUnreadNotificationCount();
  const count = unread.data ?? 0;
  return <Link className="notification-bell" to="/notifications" aria-label={`Thông báo${count ? `, ${count} chưa đọc` : ""}`}><span aria-hidden="true">♢</span>{count > 0 ? <strong>{count > 99 ? "99+" : count}</strong> : null}</Link>;
}
