import type { TicketStatus, UserRole } from "../../types/domain";

export function ticketActionFlags(role: UserRole, status: TicketStatus) {
  return {
    canReceive: role === "RECEPTIONIST" && status === "NEW",
    canAssign: role === "MANAGER" && status === "RECEIVED",
    canReassign: role === "MANAGER" && status === "ASSIGNED",
    canCancel: (role === "CUSTOMER" && status === "NEW") ||
      (role === "MANAGER" && ["NEW", "RECEIVED"].includes(status)),
    holdStatus: role === "MANAGER" && status === "RECEIVED"
      ? "ON_HOLD" as const
      : role === "MANAGER" && status === "ON_HOLD"
        ? "RECEIVED" as const
        : null,
  };
}
