import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import type { CreateDeliveryDto } from "./delivery.dto.js";
import type {
  DeliveryInvoiceRow,
  DeliveryRow,
} from "./delivery.model.js";

type DatabaseExecutor = Pool | PoolConnection;

const deliveryColumns = `
  d.id,
  d.ticket_id,
  rt.ticket_code,
  rt.customer_id,
  d.delivered_by,
  deliverer.full_name AS delivered_by_name,
  d.recipient_name,
  d.recipient_phone,
  d.proof_url,
  d.note,
  d.delivered_at
`;

export class DeliveryRepository {
  public async findByTicket(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<DeliveryRow | null> {
    const [rows] = await executor.execute<DeliveryRow[]>(
      `
        SELECT ${deliveryColumns}
        FROM deliveries AS d
        INNER JOIN repair_tickets AS rt ON rt.id = d.ticket_id
        INNER JOIN users AS deliverer ON deliverer.id = d.delivered_by
        WHERE d.ticket_id = ?
        LIMIT 1
      `,
      [ticketId],
    );
    return rows[0] ?? null;
  }

  public async findInvoiceForUpdate(
    connection: PoolConnection,
    ticketId: number,
  ): Promise<DeliveryInvoiceRow | null> {
    const [rows] = await connection.execute<DeliveryInvoiceRow[]>(
      `
        SELECT i.id, i.total_amount, i.paid_amount, i.payment_status
        FROM invoices AS i
        WHERE i.ticket_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [ticketId],
    );
    return rows[0] ?? null;
  }

  public async create(
    connection: PoolConnection,
    ticketId: number,
    deliveredBy: number,
    input: CreateDeliveryDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO deliveries (
          ticket_id, delivered_by, recipient_name, recipient_phone,
          proof_url, note
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        ticketId,
        deliveredBy,
        input.recipientName,
        input.recipientPhone ?? null,
        input.proofUrl ?? null,
        input.note ?? null,
      ],
    );
    return result.insertId;
  }

  public async createProofAttachment(
    connection: PoolConnection,
    ticketId: number,
    uploadedBy: number,
    proofUrl: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO ticket_attachments (
          ticket_id, uploaded_by, attachment_type, file_url,
          file_name, mime_type
        ) VALUES (?, ?, 'DELIVERY_PROOF', ?, 'delivery-proof', NULL)
      `,
      [ticketId, uploadedBy, proofUrl],
    );
  }

  public async createNotification(
    connection: PoolConnection,
    customerId: number,
    ticketId: number,
    ticketCode: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (
          user_id, type, title, content, reference_type, reference_id
        ) VALUES (?, 'DEVICE_DELIVERED', 'Device delivered', ?, 'REPAIR_TICKET', ?)
      `,
      [customerId, `Device handover for ticket ${ticketCode} was recorded.`, ticketId],
    );
  }

  public async createClosedNotification(
    connection: PoolConnection,
    customerId: number,
    ticketId: number,
    ticketCode: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (
          user_id, type, title, content, reference_type, reference_id
        ) VALUES (?, 'TICKET_CLOSED', 'Repair ticket closed', ?, 'REPAIR_TICKET', ?)
      `,
      [customerId, `Repair ticket ${ticketCode} has been closed after delivery.`, ticketId],
    );
  }
}

export const deliveryRepository = new DeliveryRepository();
