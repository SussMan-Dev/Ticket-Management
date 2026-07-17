import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../../config/database.js";
import type {
  CreatePaymentDto,
  ListInvoicesQuery,
} from "./payment.dto.js";
import type {
  AcceptedQuotationSnapshotRow,
  AcceptedQuotationItemPricingRow,
  ActiveManagerRow,
  FulfilledPartTotalRow,
  InvoicePaymentStatus,
  InvoiceRow,
  PaymentRow,
} from "./payment.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number;

interface CountRow extends RowDataPacket {
  total: number;
}

export interface InvoiceListRowsResult {
  rows: InvoiceRow[];
  total: number;
}

export interface CreateInvoiceRecord {
  placeholderCode: string;
  ticketId: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: InvoicePaymentStatus;
  createdBy: number;
}

const invoiceColumns = `
  i.id,
  i.invoice_code,
  i.ticket_id,
  rt.ticket_code,
  rt.status AS ticket_status,
  rt.customer_id,
  customer.full_name AS customer_name,
  customer.email AS customer_email,
  i.subtotal,
  i.discount_amount,
  i.tax_amount,
  i.total_amount,
  i.paid_amount,
  i.payment_status,
  i.created_by,
  creator.full_name AS created_by_name,
  i.created_at,
  i.updated_at
`;

const invoiceJoins = `
  INNER JOIN repair_tickets AS rt ON rt.id = i.ticket_id
  INNER JOIN users AS customer ON customer.id = rt.customer_id
  INNER JOIN users AS creator ON creator.id = i.created_by
`;

const paymentColumns = `
  p.id,
  p.payment_code,
  p.invoice_id,
  i.ticket_id,
  p.amount,
  p.method,
  p.status,
  p.transaction_reference,
  p.received_by,
  receiver.full_name AS received_by_name,
  p.paid_at,
  p.note,
  p.created_at
`;

const paymentJoins = `
  INNER JOIN invoices AS i ON i.id = p.invoice_id
  INNER JOIN users AS receiver ON receiver.id = p.received_by
`;

export class PaymentRepository {
  public async listInvoices(query: ListInvoicesQuery): Promise<InvoiceListRowsResult> {
    const conditions = ["rt.deleted_at IS NULL"];
    const params: SqlValue[] = [];
    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push(`(
        i.invoice_code LIKE ? OR rt.ticket_code LIKE ?
        OR customer.full_name LIKE ? OR customer.email LIKE ?
      )`);
      params.push(search, search, search, search);
    }
    if (query.paymentStatus) {
      conditions.push("i.payment_status = ?");
      params.push(query.paymentStatus);
    }
    if (query.customerId !== undefined) {
      conditions.push("rt.customer_id = ?");
      params.push(query.customerId);
    }
    if (query.ticketId !== undefined) {
      conditions.push("i.ticket_id = ?");
      params.push(query.ticketId);
    }
    const sortColumns: Record<ListInvoicesQuery["sortBy"], string> = {
      createdAt: "i.created_at",
      totalAmount: "i.total_amount",
      paymentStatus: "i.payment_status",
    };
    const direction = query.sortOrder === "asc" ? "ASC" : "DESC";
    const whereClause = conditions.join(" AND ");
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.query<InvoiceRow[]>(
      `
        SELECT ${invoiceColumns}
        FROM invoices AS i
        ${invoiceJoins}
        WHERE ${whereClause}
        ORDER BY ${sortColumns[query.sortBy]} ${direction}, i.id ${direction}
        LIMIT ? OFFSET ?
      `,
      [...params, query.limit, offset],
    );
    const [countRows] = await pool.execute<CountRow[]>(
      `
        SELECT COUNT(i.id) AS total
        FROM invoices AS i
        ${invoiceJoins}
        WHERE ${whereClause}
      `,
      params,
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  }

  public async findInvoiceById(
    executor: DatabaseExecutor,
    invoiceId: number,
    lockForUpdate = false,
  ): Promise<InvoiceRow | null> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<InvoiceRow[]>(
      `
        SELECT ${invoiceColumns}
        FROM invoices AS i
        ${invoiceJoins}
        WHERE i.id = ? AND rt.deleted_at IS NULL
        LIMIT 1
        ${lock}
      `,
      [invoiceId],
    );
    return rows[0] ?? null;
  }

  public async findInvoiceByTicket(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<InvoiceRow | null> {
    const [rows] = await executor.execute<InvoiceRow[]>(
      `
        SELECT ${invoiceColumns}
        FROM invoices AS i
        ${invoiceJoins}
        WHERE i.ticket_id = ?
        LIMIT 1
      `,
      [ticketId],
    );
    return rows[0] ?? null;
  }

  public async findAcceptedQuotationSnapshot(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<AcceptedQuotationSnapshotRow | null> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<AcceptedQuotationSnapshotRow[]>(
      `
        SELECT
          q.id,
          (
            SELECT COALESCE(SUM(qi.line_total), 0)
            FROM quotation_items AS qi
            WHERE qi.quotation_id = q.id
          ) AS subtotal,
          q.discount_amount,
          q.tax_amount,
          q.total_amount
        FROM quotations AS q
        WHERE q.ticket_id = ? AND q.status = 'ACCEPTED'
        ORDER BY q.version DESC, q.id DESC
        LIMIT 1
        ${lock}
      `,
      [ticketId],
    );
    return rows[0] ?? null;
  }

  public async listAcceptedQuotationItems(
    executor: DatabaseExecutor,
    quotationId: number,
    lockForUpdate = false,
  ): Promise<AcceptedQuotationItemPricingRow[]> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<AcceptedQuotationItemPricingRow[]>(
      `
        SELECT
          qi.item_type,
          qi.description,
          qi.part_id,
          qi.quantity,
          qi.unit_price,
          qi.line_total
        FROM quotation_items AS qi
        WHERE qi.quotation_id = ?
        ORDER BY qi.id ASC
        ${lock}
      `,
      [quotationId],
    );
    return rows;
  }

  public async listFulfilledPartTotals(
    executor: DatabaseExecutor,
    ticketId: number,
  ): Promise<FulfilledPartTotalRow[]> {
    const [rows] = await executor.execute<FulfilledPartTotalRow[]>(
      `
        SELECT
          pri.part_id,
          part.sku AS part_sku,
          part.name AS part_name,
          part.unit AS part_unit,
          CAST(SUM(pri.fulfilled_quantity) AS DECIMAL(12, 2)) AS quantity,
          pri.unit_price
        FROM part_request_items AS pri
        INNER JOIN part_requests AS pr ON pr.id = pri.part_request_id
        INNER JOIN parts AS part ON part.id = pri.part_id
        WHERE pr.ticket_id = ?
          AND pri.fulfilled_quantity > 0
        GROUP BY
          pri.part_id,
          part.sku,
          part.name,
          part.unit,
          pri.unit_price
        ORDER BY pri.part_id ASC, pri.unit_price ASC
      `,
      [ticketId],
    );
    return rows;
  }

  public async createInvoice(
    connection: PoolConnection,
    input: CreateInvoiceRecord,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO invoices (
          invoice_code, ticket_id, subtotal, discount_amount,
          tax_amount, total_amount, payment_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.placeholderCode,
        input.ticketId,
        input.subtotal,
        input.discountAmount,
        input.taxAmount,
        input.totalAmount,
        input.paymentStatus,
        input.createdBy,
      ],
    );
    return result.insertId;
  }

  public async setInvoiceCode(
    connection: PoolConnection,
    invoiceId: number,
    invoiceCode: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE invoices SET invoice_code = ? WHERE id = ?",
      [invoiceCode, invoiceId],
    );
  }

  public async updateInvoiceBalance(
    connection: PoolConnection,
    invoiceId: number,
    paidAmount: number,
    status: InvoicePaymentStatus,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?",
      [paidAmount, status, invoiceId],
    );
  }

  public async listPayments(
    executor: DatabaseExecutor,
    invoiceId: number,
  ): Promise<PaymentRow[]> {
    const [rows] = await executor.execute<PaymentRow[]>(
      `
        SELECT ${paymentColumns}
        FROM payments AS p
        ${paymentJoins}
        WHERE p.invoice_id = ?
        ORDER BY p.paid_at DESC, p.id DESC
      `,
      [invoiceId],
    );
    return rows;
  }

  public async findPaymentById(
    executor: DatabaseExecutor,
    paymentId: number,
    lockForUpdate = false,
  ): Promise<PaymentRow | null> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<PaymentRow[]>(
      `
        SELECT ${paymentColumns}
        FROM payments AS p
        ${paymentJoins}
        WHERE p.id = ?
        LIMIT 1
        ${lock}
      `,
      [paymentId],
    );
    return rows[0] ?? null;
  }

  public async createPayment(
    connection: PoolConnection,
    invoiceId: number,
    placeholderCode: string,
    input: CreatePaymentDto,
    receivedBy: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO payments (
          payment_code, invoice_id, amount, method,
          transaction_reference, received_by, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        placeholderCode,
        invoiceId,
        input.amount,
        input.method,
        input.transactionReference ?? null,
        receivedBy,
        input.note ?? null,
      ],
    );
    return result.insertId;
  }

  public async setPaymentCode(
    connection: PoolConnection,
    paymentId: number,
    paymentCode: string,
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      "UPDATE payments SET payment_code = ? WHERE id = ?",
      [paymentCode, paymentId],
    );
  }

  public async markPaymentRefunded(
    connection: PoolConnection,
    paymentId: number,
  ): Promise<void> {
    const [result] = await connection.execute<ResultSetHeader>(
      "UPDATE payments SET status = 'REFUNDED' WHERE id = ? AND status = 'COMPLETED'",
      [paymentId],
    );
    if (result.affectedRows !== 1) {
      throw new Error("Payment refund update lost its row lock");
    }
  }

  public async findActiveManager(
    executor: DatabaseExecutor,
    managerId: number,
  ): Promise<ActiveManagerRow | null> {
    const [rows] = await executor.execute<ActiveManagerRow[]>(
      `
        SELECT u.id, u.full_name
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE u.id = ?
          AND r.code = 'MANAGER'
          AND u.status = 'ACTIVE'
          AND u.deleted_at IS NULL
          AND (u.locked_until IS NULL OR u.locked_until <= CURRENT_TIMESTAMP)
        LIMIT 1
      `,
      [managerId],
    );
    return rows[0] ?? null;
  }

  public async listActiveManagers(
    executor: DatabaseExecutor,
  ): Promise<ActiveManagerRow[]> {
    const [rows] = await executor.execute<ActiveManagerRow[]>(
      `
        SELECT u.id, u.full_name
        FROM users AS u
        INNER JOIN roles AS r ON r.id = u.role_id
        WHERE r.code = 'MANAGER'
          AND u.status = 'ACTIVE'
          AND u.deleted_at IS NULL
          AND (u.locked_until IS NULL OR u.locked_until <= CURRENT_TIMESTAMP)
        ORDER BY u.full_name ASC, u.id ASC
      `,
    );
    return rows;
  }

  public async createNotification(
    connection: PoolConnection,
    input: {
      customerId: number;
      title: string;
      content: string;
      invoiceId: number;
    },
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (
          user_id, type, title, content, reference_type, reference_id
        ) VALUES (?, 'PAYMENT_UPDATE', ?, ?, 'INVOICE', ?)
      `,
      [input.customerId, input.title, input.content, input.invoiceId],
    );
  }
}

export const paymentRepository = new PaymentRepository();
