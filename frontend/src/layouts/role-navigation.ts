import type { UserRole } from "../types/domain";

export interface NavigationItem { label: string; to: string; icon: string; end?: boolean }

const common: NavigationItem[] = [
  { label: "Trang chủ", to: "/", icon: "⌂", end: true },
  { label: "Hồ sơ cá nhân", to: "/profile", icon: "○" },
];

const operational: NavigationItem[] = [
  { label: "Phiếu sửa chữa", to: "/tickets", icon: "▤" },
];

export function navigationForRole(role: UserRole): NavigationItem[] {
  switch (role) {
    case "CUSTOMER":
      return [...common, { label: "Thiết bị của tôi", to: "/devices", icon: "▣" }, ...operational, { label: "Hóa đơn", to: "/invoices", icon: "₫" }];
    case "RECEPTIONIST":
      return [...common, { label: "Khách hàng", to: "/customers", icon: "◎" }, { label: "Thiết bị", to: "/devices", icon: "▣" }, ...operational];
    case "TECHNICIAN":
      return [...common, ...operational, { label: "Danh mục linh kiện", to: "/parts", icon: "◇" }, { label: "Yêu cầu cấp linh kiện", to: "/part-requests", icon: "⇄" }];
    case "MANAGER":
      return [...common, ...operational, { label: "Khách hàng", to: "/customers", icon: "◎" }, { label: "Linh kiện", to: "/parts", icon: "◇" }, { label: "Yêu cầu cấp linh kiện", to: "/part-requests", icon: "⇄" }, { label: "Hóa đơn", to: "/invoices", icon: "▧" }, { label: "Báo cáo", to: "/reports", icon: "▥" }];
    case "ADMIN":
      return [...common, { label: "Tài khoản", to: "/users", icon: "♙" }];
    case "INVENTORY_STAFF":
      return [...common, { label: "Linh kiện & kho", to: "/parts", icon: "◇" }, { label: "Yêu cầu cấp linh kiện", to: "/part-requests", icon: "⇄" }, { label: "Báo cáo kho", to: "/reports", icon: "▥" }];
    case "CASHIER":
      return [...common, { label: "Hóa đơn & thanh toán", to: "/invoices", icon: "₫" }];
  }
}
