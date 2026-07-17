import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  ALLOWED_TICKET_TRANSITIONS,
  type TicketStatus,
} from "../../common/constants/ticket-status.js";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import {
  repairTicketRepository,
  type RepairTicketRepository,
} from "../repair-tickets/repair-ticket.repository.js";
import type {
  CreatePaymentDto,
  ListInvoicesQuery,
  RefundPaymentDto,
} from "./payment.dto.js";
import {
  toInvoice,
  toPayment,
  type Invoice,
  type InvoiceCostBreakdown,
  type InvoiceCostLine,
  type InvoiceDetail,
  type InvoicePaymentStatus,
  type InvoicePreview,
  type InvoiceRow,
  type Payment,
  type PaymentRow,
  type RefundApprover,
} from "./payment.model.js";
import {
  paymentRepository,
  type PaymentRepository,
} from "./payment.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

export interface ListInvoicesResult {
  invoices: Invoice[];
  total: number;
}

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

function formatCode(prefix: "INV" | "PAY", id: number, now = new Date()): string {
  return `${prefix}-${now.getUTCFullYear()}-${String(id).padStart(6, "0")}`;
}

export class PaymentService {
  public constructor(
    private readonly repository: PaymentRepository = paymentRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listInvoices(
    actor: Express.AuthenticatedUser,
    query: ListInvoicesQuery,
  ): Promise<ListInvoicesResult> {
    let scopedQuery = query;
    if (actor.role === "CUSTOMER") {
      if (query.customerId !== undefined && query.customerId !== actor.id) {
        throw new ForbiddenError(
          "You may view only your own invoices",
          "INVOICE_ACCESS_DENIED",
        );
      }
      scopedQuery = { ...query, customerId: actor.id };
    } else if (actor.role !== "CASHIER" && actor.role !== "MANAGER") {
      throw new ForbiddenError("You are not allowed to view invoices", "FORBIDDEN");
    }
    const result = await this.repository.listInvoices(scopedQuery);
    return { invoices: result.rows.map(toInvoice), total: result.total };
  }

  public async getInvoice(
    actor: Express.AuthenticatedUser,
    invoiceId: number,
  ): Promise<InvoiceDetail> {
    const invoice = await this.requireInvoice(pool, invoiceId);
    this.assertInvoiceReadScope(actor, invoice);
    const pricing = await this.calculateInvoiceCostBreakdown(
      pool,
      invoice.ticket_id,
    );
    return { ...toInvoice(invoice), costBreakdown: pricing.costBreakdown };
  }

  public async previewInvoice(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<InvoicePreview> {
    this.assertCashier(actor);
    const ticket = await this.requireTicket(pool, ticketId);
    this.assertTicketCanBeInvoiced(ticket);
    if (await this.repository.findInvoiceByTicket(pool, ticketId)) {
      throw new ConflictError(
        "This repair ticket already has an invoice",
        "INVOICE_ALREADY_EXISTS",
      );
    }
    const pricing = await this.calculateInvoiceCostBreakdown(pool, ticketId);
    return {
      ticket: {
        id: ticket.id,
        ticketCode: ticket.ticket_code,
        title: ticket.title,
      },
      customer: {
        id: ticket.customer_id,
        fullName: ticket.customer_name,
      },
      costBreakdown: pricing.costBreakdown,
    };
  }

  public async createInvoice(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    metadata: RequestMetadata,
  ): Promise<InvoiceDetail> {
    this.assertCashier(actor);
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      this.assertTicketCanBeInvoiced(ticket);
      if (await this.repository.findInvoiceByTicket(connection, ticketId)) {
        throw new ConflictError(
          "This repair ticket already has an invoice",
          "INVOICE_ALREADY_EXISTS",
        );
      }
      const pricing = await this.calculateInvoiceCostBreakdown(
        connection,
        ticketId,
        true,
      );
      const breakdown = pricing.costBreakdown;
      const totalCents = toCents(breakdown.totalAmount);
      const initialStatus: InvoicePaymentStatus = totalCents === 0
        ? "PAID"
        : "UNPAID";
      const invoiceId = await this.repository.createInvoice(connection, {
        placeholderCode: `TMP-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        ticketId,
        subtotal: breakdown.subtotal,
        discountAmount: breakdown.discountAmount,
        taxAmount: breakdown.taxAmount,
        totalAmount: breakdown.totalAmount,
        paymentStatus: initialStatus,
        createdBy: actor.id,
      });
      const invoiceCode = formatCode("INV", invoiceId, this.now());
      await this.repository.setInvoiceCode(connection, invoiceId, invoiceCode);
      if (initialStatus === "PAID") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "READY_FOR_DELIVERY",
          `Zero-balance invoice ${invoiceCode} issued`,
        );
      }
      await this.repository.createNotification(connection, {
        customerId: ticket.customer_id,
        title: "Hóa đơn đã được phát hành",
        content: `Hóa đơn ${invoiceCode} đã được phát hành cho phiếu sửa chữa ${ticket.ticket_code}.`,
        invoiceId,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "INVOICE_CREATED",
        entityType: "INVOICE",
        entityId: invoiceId,
        oldData: null,
        newData: {
          ticketId,
          quotationId: pricing.quotationId,
          quotationRole: "ESTIMATE_BASE",
          partPricingSource: "PART_REQUEST_SNAPSHOT",
          nonPartSubtotal: breakdown.serviceSubtotal,
          fulfilledPartsSubtotal: breakdown.partSubtotal,
          subtotal: breakdown.subtotal,
          discountAmount: breakdown.discountAmount,
          taxAmount: breakdown.taxAmount,
          totalAmount: breakdown.totalAmount,
        },
        ...requestMetadata,
      });
      return {
        ...toInvoice(await this.requireInvoice(connection, invoiceId)),
        costBreakdown: breakdown,
      };
    });
  }

  public async listPayments(
    actor: Express.AuthenticatedUser,
    invoiceId: number,
  ): Promise<Payment[]> {
    const invoice = await this.requireInvoice(pool, invoiceId);
    this.assertInvoiceReadScope(actor, invoice);
    return (await this.repository.listPayments(pool, invoiceId)).map(toPayment);
  }

  public async createPayment(
    actor: Express.AuthenticatedUser,
    invoiceId: number,
    input: CreatePaymentDto,
    metadata: RequestMetadata,
  ): Promise<Payment> {
    this.assertCashier(actor);
    const reference = await this.requireInvoice(pool, invoiceId);
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const invoice = await this.requireInvoice(connection, invoiceId, true);
      if (!["COMPLETED", "READY_FOR_DELIVERY"].includes(ticket.status)) {
        throw new ConflictError(
          "Payments cannot be recorded in the ticket's current state",
          "TICKET_NOT_BILLABLE",
        );
      }
      const totalCents = toCents(invoice.total_amount);
      const paidCents = toCents(invoice.paid_amount);
      const paymentCents = toCents(input.amount);
      const balanceCents = totalCents - paidCents;
      if (paymentCents > balanceCents) {
        throw new ConflictError(
          "Payment amount exceeds the outstanding invoice balance",
          "PAYMENT_EXCEEDS_BALANCE",
          { balanceAmount: fromCents(balanceCents) },
        );
      }
      if (balanceCents <= 0) {
        throw new ConflictError("Invoice is already paid", "INVOICE_ALREADY_PAID");
      }
      const normalizedInput = { ...input, amount: fromCents(paymentCents) };
      const paymentId = await this.repository.createPayment(
        connection,
        invoiceId,
        `TMP-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        normalizedInput,
        actor.id,
      );
      const paymentCode = formatCode("PAY", paymentId, this.now());
      await this.repository.setPaymentCode(connection, paymentId, paymentCode);
      const newPaidCents = paidCents + paymentCents;
      const status: InvoicePaymentStatus = newPaidCents === totalCents
        ? "PAID"
        : "PARTIALLY_PAID";
      await this.repository.updateInvoiceBalance(
        connection,
        invoiceId,
        fromCents(newPaidCents),
        status,
      );
      if (status === "PAID" && ticket.status === "COMPLETED") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "READY_FOR_DELIVERY",
          `Invoice ${invoice.invoice_code} paid in full`,
        );
      }
      await this.repository.createNotification(connection, {
        customerId: invoice.customer_id,
        title: status === "PAID" ? "Hóa đơn đã được thanh toán" : "Đã nhận thanh toán",
        content: `Khoản thanh toán ${paymentCode} cho hóa đơn ${invoice.invoice_code} đã được ghi nhận thành công.`,
        invoiceId,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "PAYMENT_RECORDED",
        entityType: "PAYMENT",
        entityId: paymentId,
        oldData: null,
        newData: {
          invoiceId,
          amount: normalizedInput.amount,
          method: input.method,
          invoicePaidAmount: fromCents(newPaidCents),
          invoiceStatus: status,
        },
        ...requestMetadata,
      });
      return toPayment(await this.requirePayment(connection, paymentId));
    });
  }

  public async refundPayment(
    actor: Express.AuthenticatedUser,
    paymentId: number,
    input: RefundPaymentDto,
    metadata: RequestMetadata,
  ): Promise<Payment> {
    this.assertCashier(actor);
    if (input.managerApprovalId === actor.id) {
      throw new ForbiddenError(
        "Refund approval must come from a manager other than the cashier",
        "INDEPENDENT_MANAGER_APPROVAL_REQUIRED",
      );
    }
    const reference = await this.requirePayment(pool, paymentId);
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, reference.ticket_id, true);
      const invoice = await this.requireInvoice(connection, reference.invoice_id, true);
      const payment = await this.requirePayment(connection, paymentId, true);
      const manager = await this.repository.findActiveManager(
        connection,
        input.managerApprovalId,
      );
      if (!manager) {
        throw new ForbiddenError(
          "An active manager approval is required",
          "MANAGER_APPROVAL_REQUIRED",
        );
      }
      if (payment.status !== "COMPLETED") {
        throw new ConflictError(
          "Only a completed, non-refunded payment may be refunded",
          "PAYMENT_NOT_REFUNDABLE",
        );
      }
      const paidCents = toCents(invoice.paid_amount);
      const refundCents = toCents(payment.amount);
      if (refundCents > paidCents) {
        throw new ConflictError(
          "Refund exceeds the valid paid amount",
          "REFUND_EXCEEDS_PAID_AMOUNT",
        );
      }
      const newPaidCents = paidCents - refundCents;
      const invoiceStatus: InvoicePaymentStatus = newPaidCents === 0
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";
      await this.repository.markPaymentRefunded(connection, paymentId);
      await this.repository.updateInvoiceBalance(
        connection,
        invoice.id,
        fromCents(newPaidCents),
        invoiceStatus,
      );
      if (ticket.status === "READY_FOR_DELIVERY") {
        await this.transitionTicket(
          connection,
          actor.id,
          ticket,
          "COMPLETED",
          `Payment ${payment.payment_code} refunded before delivery`,
        );
      }
      await this.repository.createNotification(connection, {
        customerId: invoice.customer_id,
        title: "Khoản thanh toán đã được hoàn tiền",
        content: `Khoản thanh toán ${payment.payment_code} cho hóa đơn ${invoice.invoice_code} đã được hoàn tiền.`,
        invoiceId: invoice.id,
      });
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "PAYMENT_REFUNDED",
        entityType: "PAYMENT",
        entityId: paymentId,
        oldData: {
          paymentStatus: payment.status,
          invoicePaidAmount: invoice.paid_amount,
          invoiceStatus: invoice.payment_status,
        },
        newData: {
          paymentStatus: "REFUNDED",
          refundAmount: payment.amount,
          invoicePaidAmount: fromCents(newPaidCents),
          invoiceStatus,
          approvedBy: { id: manager.id, fullName: manager.full_name },
          reason: input.reason,
        },
        ...requestMetadata,
      });
      return toPayment(await this.requirePayment(connection, paymentId));
    });
  }

  public async listRefundApprovers(
    actor: Express.AuthenticatedUser,
  ): Promise<RefundApprover[]> {
    this.assertCashier(actor);
    return (await this.repository.listActiveManagers(pool)).map((manager) => ({
      id: manager.id,
      fullName: manager.full_name,
    }));
  }

  private assertCashier(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "CASHIER") {
      throw new ForbiddenError("Only cashiers may manage billing", "FORBIDDEN");
    }
  }

  private assertTicketCanBeInvoiced(ticket: RepairTicketRow): void {
    if (ticket.status !== "COMPLETED") {
      throw new ConflictError(
        "Only a completed repair ticket may be invoiced",
        "TICKET_NOT_COMPLETED",
      );
    }
  }

  private async calculateInvoiceCostBreakdown(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<{ quotationId: number; costBreakdown: InvoiceCostBreakdown }> {
    const quotation = await this.repository.findAcceptedQuotationSnapshot(
      executor,
      ticketId,
      lockForUpdate,
    );
    if (!quotation) {
      throw new ConflictError(
        "An accepted quotation is required before invoicing",
        "ACCEPTED_QUOTATION_REQUIRED",
      );
    }
    const quotationItems = await this.repository.listAcceptedQuotationItems(
      executor,
      quotation.id,
      lockForUpdate,
    );
    const fulfilledParts = await this.repository.listFulfilledPartTotals(
      executor,
      ticketId,
    );
    const lines: InvoiceCostLine[] = [];
    let serviceSubtotalCents = 0;
    for (const item of quotationItems) {
      if (item.item_type === "PART") continue;
      const lineTotalCents = toCents(item.line_total);
      serviceSubtotalCents += lineTotalCents;
      lines.push({
        type: item.item_type,
        description: item.description,
        part: null,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: fromCents(lineTotalCents),
        source: "ACCEPTED_QUOTATION",
      });
    }
    let partSubtotalCents = 0;
    for (const fulfilled of fulfilledParts) {
      const lineTotalCents = toCents(fulfilled.quantity * fulfilled.unit_price);
      partSubtotalCents += lineTotalCents;
      lines.push({
        type: "PART",
        description: fulfilled.part_name,
        part: {
          id: fulfilled.part_id,
          sku: fulfilled.part_sku,
          name: fulfilled.part_name,
          unit: fulfilled.part_unit,
        },
        quantity: fulfilled.quantity,
        unitPrice: fulfilled.unit_price,
        lineTotal: fromCents(lineTotalCents),
        source: "FULFILLED_PART_REQUEST",
      });
    }
    const subtotalCents = serviceSubtotalCents + partSubtotalCents;
    const discountCents = toCents(quotation.discount_amount);
    const taxCents = toCents(quotation.tax_amount);
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
    return {
      quotationId: quotation.id,
      costBreakdown: {
        lines,
        serviceSubtotal: fromCents(serviceSubtotalCents),
        partSubtotal: fromCents(partSubtotalCents),
        subtotal: fromCents(subtotalCents),
        discountAmount: fromCents(discountCents),
        taxAmount: fromCents(taxCents),
        totalAmount: fromCents(totalCents),
      },
    };
  }

  private assertInvoiceReadScope(
    actor: Express.AuthenticatedUser,
    invoice: InvoiceRow,
  ): void {
    if (actor.role === "CASHIER" || actor.role === "MANAGER") return;
    if (actor.role === "CUSTOMER" && actor.id === invoice.customer_id) return;
    throw new ForbiddenError(
      "You are not allowed to view this invoice",
      "INVOICE_ACCESS_DENIED",
    );
  }

  private async requireInvoice(
    executor: DatabaseExecutor,
    invoiceId: number,
    lockForUpdate = false,
  ): Promise<InvoiceRow> {
    const invoice = await this.repository.findInvoiceById(
      executor,
      invoiceId,
      lockForUpdate,
    );
    if (!invoice) throw new NotFoundError("Invoice not found", "INVOICE_NOT_FOUND");
    return invoice;
  }

  private async requirePayment(
    executor: DatabaseExecutor,
    paymentId: number,
    lockForUpdate = false,
  ): Promise<PaymentRow> {
    const payment = await this.repository.findPaymentById(
      executor,
      paymentId,
      lockForUpdate,
    );
    if (!payment) throw new NotFoundError("Payment not found", "PAYMENT_NOT_FOUND");
    return payment;
  }

  private async requireTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(executor, ticketId, lockForUpdate);
    if (!ticket) {
      throw new NotFoundError("Repair ticket not found", "REPAIR_TICKET_NOT_FOUND");
    }
    return ticket;
  }

  private async transitionTicket(
    connection: PoolConnection,
    actorId: number,
    ticket: RepairTicketRow,
    targetStatus: TicketStatus,
    reason: string,
  ): Promise<void> {
    if (!ALLOWED_TICKET_TRANSITIONS[ticket.status].includes(targetStatus)) {
      throw new ConflictError(
        `Ticket cannot transition from ${ticket.status} to ${targetStatus}`,
        "INVALID_TICKET_TRANSITION",
      );
    }
    await this.tickets.updateStatus(connection, ticket.id, targetStatus);
    await this.tickets.createStatusHistory(connection, {
      ticketId: ticket.id,
      changedBy: actorId,
      fromStatus: ticket.status,
      toStatus: targetStatus,
      reason,
    });
  }
}

export const paymentService = new PaymentService();
