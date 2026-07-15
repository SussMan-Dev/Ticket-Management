import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { AppFooter } from "../components/ui/app-footer";
import { UserAvatar } from "../components/ui/user-avatar";
import { useAuth } from "../lib/auth/use-auth";
import { NotificationBell } from "../features/notifications/notification-bell";
import { navigationForRole } from "./role-navigation";

const roleLabels: Record<string, string> = {
  CUSTOMER: "Khách hàng", RECEPTIONIST: "Lễ tân", TECHNICIAN: "Kỹ thuật viên",
  MANAGER: "Quản lý", ADMIN: "Quản trị viên", INVENTORY_STAFF: "Kho", CASHIER: "Thu ngân",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    void navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawerOpen ? "sidebar--open" : ""}`} aria-label="Điều hướng chính">
        <div className="brand"><span className="brand__mark">EF</span><span><strong>ElectronicFixer</strong><small>Repair operations</small></span></div>
        <nav className="sidebar__nav">
          <span className="sidebar__label">Không gian làm việc</span>
          {navigationForRole(user.role).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setDrawerOpen(false)} className={({ isActive }) => isActive ? "nav-link nav-link--active" : "nav-link"}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer"><div className="mini-profile"><UserAvatar fullName={user.fullName} src={user.avatarUrl} /><span><strong>{user.fullName}</strong><small>{roleLabels[user.role]}</small></span></div><Button variant="ghost" size="sm" onClick={() => void handleLogout()}>Đăng xuất</Button></div>
      </aside>
      {drawerOpen ? <button className="drawer-scrim" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)} /> : null}
      <div className="app-content">
        <header className="topbar">
          <div className="topbar__inner">
            <button className="menu-button" aria-label="Mở menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>☰</button>
            <div className="topbar__context"><span className="status-dot" />Hệ thống vận hành</div>
            <div className="topbar__user"><NotificationBell /><UserAvatar fullName={user.fullName} src={user.avatarUrl} size="small" /><span className="topbar__user-copy"><strong>{user.fullName}</strong><small>{roleLabels[user.role]}</small></span></div>
          </div>
        </header>
        <main id="main-content" className="main-content"><Outlet /></main>
        <AppFooter />
      </div>
    </div>
  );
}
