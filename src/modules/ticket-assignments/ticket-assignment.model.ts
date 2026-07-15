import type { RowDataPacket } from "mysql2";
import type { UserRole } from "../../common/constants/roles.js";
import type { UserAccountStatus } from "../users/user.model.js";

export interface AssignableTechnicianRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  locked_until: Date | null;
}

export interface TicketAssignmentRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  technician_id: number;
  technician_name: string;
  technician_email: string;
  assigned_by: number;
  assigned_by_name: string;
  assigned_at: Date;
  unassigned_at: Date | null;
  is_active: number | boolean;
  note: string | null;
}

export interface TicketAssignment {
  id: number;
  ticketId: number;
  technician: {
    id: number;
    fullName: string;
    email: string;
  };
  assignedBy: {
    id: number;
    fullName: string;
  };
  assignedAt: Date;
  unassignedAt: Date | null;
  isActive: boolean;
  note: string | null;
}

export interface AssignableTechnician {
  id: number;
  fullName: string;
  email: string;
}

export function toAssignableTechnician(row: AssignableTechnicianRow): AssignableTechnician {
  return { id: row.id, fullName: row.full_name, email: row.email };
}

export function toTicketAssignment(row: TicketAssignmentRow): TicketAssignment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    technician: {
      id: row.technician_id,
      fullName: row.technician_name,
      email: row.technician_email,
    },
    assignedBy: {
      id: row.assigned_by,
      fullName: row.assigned_by_name,
    },
    assignedAt: row.assigned_at,
    unassignedAt: row.unassigned_at,
    isActive: Boolean(row.is_active),
    note: row.note,
  };
}
