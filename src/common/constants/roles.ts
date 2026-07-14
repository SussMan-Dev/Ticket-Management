export const USER_ROLES = [
  "CUSTOMER",
  "RECEPTIONIST",
  "TECHNICIAN",
  "MANAGER",
  "ADMIN",
  "INVENTORY_STAFF",
  "CASHIER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
