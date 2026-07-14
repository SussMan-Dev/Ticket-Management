# Payments

## Responsibility

Create one invoice per ticket, record partial/full payments, maintain payment status, and process manager-approved refunds.

## Main entities

Invoice and payment.

## Main files

Planned under `src/modules/payments/` using the standard seven-file module structure; invoice operations belong to the same billing boundary.

## Public APIs

Invoice list/detail/create, invoice payment list/create, and payment refund. Planned for Phase 9.

## Allowed roles

Cashiers create invoices and record payments. Managers approve refund/exception policy. Owning customers view their invoice and payments.

## Business rules

One invoice per ticket. Server calculates totals. Valid payments cannot exceed total. Completed payments are immutable; refund is a separate audited operation.

## State transitions

Invoice `UNPAID` → `PARTIALLY_PAID` → `PAID`; refund produces `PARTIALLY_REFUNDED` or `REFUNDED`. Payment moves from pending to completed/failed/refunded through controlled operations.

## Database tables

`invoices`, `payments`, `repair_tickets`, `ticket_status_history`, and `audit_logs`.

## Transactions

Required for invoice creation, payment plus invoice balance/status, refund, and readiness-for-delivery changes.

## Dependencies

Quotations, repair tickets, users, notifications, and delivery.

## Common errors

Ticket not completed, duplicate invoice, amount exceeds balance, invalid method, refund exceeds paid value, and unauthorized cashier action.

## Security considerations

Never store card details. Treat external transaction references as untrusted input. Recalculate balances under row lock and audit all refunds.
