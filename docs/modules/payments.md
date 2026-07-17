# Payments

## Responsibility

Preview and create one server-calculated, itemized invoice per completed ticket, record partial/full payments, maintain the locked invoice balance, process manager-approved whole-payment refunds, and own billing readiness transitions.

## Main entities

Invoice and immutable-amount payment.

## Main files

Implemented under `src/modules/payments/` using route, controller, service, repository, model, schema, and DTO files. Invoice operations stay in the same billing boundary.

## Public APIs

- `GET /invoices` and `GET /invoices/:id`
- `GET /repair-tickets/:ticketId/invoice-preview`
- `POST /repair-tickets/:ticketId/invoices`
- `GET/POST /invoices/:id/payments`
- `GET /payments/refund-approvers`
- `POST /payments/:id/refund`

The cashier ticket list is restricted to `COMPLETED` tickets so the invoice creation UI can locate only billable work.

## Allowed roles

Cashiers create invoices, record payments, and execute approved refunds. Active managers are exposed as minimal refund-approver choices. Managers have read-only billing visibility; owning customers see only their own invoices and payments.

## Business rules

- Exactly one invoice may exist per ticket, and only while the locked ticket is `COMPLETED`.
- The accepted diagnosis estimate supplies labor/other line totals, discount, and tax. Provisional quotation part lines are excluded from billing; client totals are never accepted.
- The part subtotal uses cumulative quantities actually fulfilled by inventory and each request item's snapshotted unit price. A repair-time part does not need to appear in the diagnosis estimate to be billed after warehouse fulfillment.
- Cashier preview and invoice detail expose the same server-derived `costBreakdown`: individual labor/other lines, fulfilled-part lines with SKU/unit, service and part subtotals, discount, tax, and final total. Preview is read-only; invoice creation locks and recalculates the data before writing.
- Payment amounts are positive, limited to two decimal places, and checked in integer cents against the locked outstanding balance.
- Each recorded payment is immediately `COMPLETED`; amount, method, reference, receiver, and paid time are never edited.
- Refund applies to one whole `COMPLETED` payment. The row changes only to `REFUNDED`; the original amount and metadata remain intact.
- Refund requires a distinct active manager approval ID plus a reason. Approval identity, cashier, reason, before/after balance, and request metadata are audited.
- Fully paid invoices move a `COMPLETED` ticket to `READY_FOR_DELIVERY`. A pre-delivery refund moves it back to `COMPLETED`.
- Zero-value accepted quotations create a `PAID` invoice and immediately make the ticket ready for delivery.

## State transitions

Invoice collection uses `UNPAID → PARTIALLY_PAID → PAID`. Refunding one of multiple payments produces `PARTIALLY_REFUNDED`; refunding the last valid payment produces `REFUNDED`. A later valid payment recalculates the live collection status. Payment rows use `COMPLETED → REFUNDED` only through the refund command.

## Database tables

`invoices`, `payments`, `repair_tickets`, `ticket_status_history`, `notifications`, and `audit_logs`. The existing schema supports whole-payment refunds, so Phase 9 requires no migration.

## Transactions

Invoice creation locks the ticket and accepted estimate items, then reads cumulative fulfilled-part totals and request-time price snapshots. Payment/refund locks ticket, invoice, then payment where applicable. Balance/status, payment row, ticket history, notification, and audit evidence commit or roll back together.

## Common errors

Ticket not completed, accepted quotation missing, duplicate invoice, amount exceeds balance, invalid method/precision, inactive manager approval, already-refunded payment, and owner/role access denial.

## Security considerations

Never store card details. Treat external transaction references as untrusted text. Middleware role checks are followed by service ownership checks. Refund approval lookup returns only active manager ID/name and financial/audit history is never deleted.
