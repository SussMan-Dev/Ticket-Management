import type { RowDataPacket } from "mysql2";
import type { TicketStatus } from "../../common/constants/ticket-status.js";

export interface ReviewRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  ticket_code: string;
  ticket_status: TicketStatus;
  customer_id: number;
  customer_name: string;
  rating: number;
  technician_rating: number | null;
  service_rating: number | null;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Review {
  id: number;
  ticket: { id: number; ticketCode: string };
  customer: { id: number; fullName: string };
  rating: number;
  technicianRating: number | null;
  serviceRating: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    ticket: { id: row.ticket_id, ticketCode: row.ticket_code },
    customer: { id: row.customer_id, fullName: row.customer_name },
    rating: row.rating,
    technicianRating: row.technician_rating,
    serviceRating: row.service_rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

