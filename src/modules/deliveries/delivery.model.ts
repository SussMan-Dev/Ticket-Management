import type { RowDataPacket } from "mysql2";
import type { InvoicePaymentStatus } from "../payments/payment.model.js";

export interface DeliveryRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  ticket_code: string;
  customer_id: number;
  delivered_by: number;
  delivered_by_name: string;
  recipient_name: string;
  recipient_phone: string | null;
  proof_url: string | null;
  note: string | null;
  delivered_at: Date;
}

export interface DeliveryInvoiceRow extends RowDataPacket {
  id: number;
  total_amount: number;
  paid_amount: number;
  payment_status: InvoicePaymentStatus;
}

export interface Delivery {
  id: number;
  ticket: { id: number; ticketCode: string };
  deliveredBy: { id: number; fullName: string };
  recipientName: string;
  recipientPhone: string | null;
  proofUrl: string | null;
  note: string | null;
  deliveredAt: Date;
}

export interface DeliveryClosureResult {
  ticketId: number;
  status: "CLOSED";
}

export function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    ticket: { id: row.ticket_id, ticketCode: row.ticket_code },
    deliveredBy: { id: row.delivered_by, fullName: row.delivered_by_name },
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    proofUrl: row.proof_url,
    note: row.note,
    deliveredAt: row.delivered_at,
  };
}
