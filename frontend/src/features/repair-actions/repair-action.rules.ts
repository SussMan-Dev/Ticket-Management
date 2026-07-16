import type { TicketStatus, UserRole } from "../../types/domain";

export function canWriteRepairLog(role: UserRole, status: TicketStatus): boolean {
  return role === "TECHNICIAN" && ["WAITING_FOR_PARTS", "REPAIRING"].includes(status);
}
