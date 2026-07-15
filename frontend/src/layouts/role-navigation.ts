import type { UserRole } from "../types/domain";

export interface NavigationItem { label: string; to: string; icon: string; end?: boolean }

const common: NavigationItem[] = [
  { label: "Tổng quan", to: "/", icon: "⌂", end: true },
  { label: "Hồ sơ", to: "/profile", icon: "○" },
];

const operational: NavigationItem[] = [
  { label: "Phiếu sửa chữa", to: "/tickets", icon: "▤" },
];

export function navigationForRole(role: UserRole): NavigationItem[] {
  switch (role) {
    case "CUSTOMER":
      return [...common, { label: "Thiết bị của tôi", to: "/devices", icon: "▣" }, ...operational];
    case "RECEPTIONIST":
      return [...common, { label: "Khách hàng", to: "/customers", icon: "◎" }, { label: "Thiết bị", to: "/devices", icon: "▣" }, ...operational];
    case "TECHNICIAN":
      return [...common, ...operational];
    case "MANAGER":
      return [...common, ...operational, { label: "Khách hàng", to: "/customers", icon: "◎" }];
    case "ADMIN":
      return [...common, { label: "Tài khoản", to: "/users", icon: "♙" }];
    case "INVENTORY_STAFF":
    case "CASHIER":
      return [...common, { label: "Module mở rộng", to: "/extension", icon: "+" }];
  }
}
