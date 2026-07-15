export interface AssignTicketDto {
  technicianId: number;
  note?: string | null;
}

export interface ReassignTicketDto {
  technicianId: number;
  note: string;
}

export interface ListAssignableTechniciansQuery {
  search?: string;
}
