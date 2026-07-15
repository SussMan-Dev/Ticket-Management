# Deliveries

## Responsibility

Record device handover, recipient identity, proof, delivery time, and final ticket closure.

## Main entities

Delivery and delivery proof attachment.

## Main files

Implemented under `src/modules/deliveries/` using the standard seven-file module structure.

## Public APIs

`POST /repair-tickets/:ticketId/deliver`, `GET /repair-tickets/:ticketId/delivery`, and `POST /repair-tickets/:ticketId/close`. Implemented in Phase 10.

## Allowed roles

Receptionists perform normal paid delivery. Managers perform only documented unpaid exceptions. Receptionists and managers may close a delivered ticket; the owning customer views handover.

## Business rules

Ticket must be ready, normally fully paid, and not previously delivered. A rejected quotation may be returned by Receptionist; an unpaid completed/ready ticket requires an explicit Manager reason. Record actor, recipient, and time. A ticket has one delivery record. Closure requires `DELIVERED` and that persisted record.

## State transitions

`READY_FOR_DELIVERY` → `DELIVERED` → `CLOSED`.

## Database tables

`deliveries`, `repair_tickets`, `invoices`, `ticket_status_history`, `ticket_attachments`, and `audit_logs`.

## Transactions

Always required for delivery record, ticket timestamps/status/history, proof reference, and audit entry.

## Dependencies

Repair tickets, payments, customers, and notifications.

## Common errors

Unpaid invoice, ticket not ready, already delivered, recipient validation failure, and missing manager exception.

## Security considerations

Validate proof URLs, limit recipient data exposure, and audit exceptions. Never accept customer confirmation for a different customer's ticket.
