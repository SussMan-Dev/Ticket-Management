# Quotations

## Responsibility

Create versioned quotations, snapshot prices, manage approval/sending/expiry, and record the owning customer's response.

## Main entities

Quotation and quotation item.

## Main files

Planned under `src/modules/quotations/` using the standard seven-file module structure.

## Public APIs

Ticket quotation list/create; quotation detail/update, submit, approve, send, accept, and reject. Planned for Phase 6.

## Allowed roles

Managers create/approve/send; authorized staff may prepare drafts by policy; only the owning customer accepts/rejects; technicians have read-only context.

## Business rules

Items snapshot descriptions and prices. Version is unique per ticket. Only one current quotation exists; replacement supersedes the prior one. Expired quotations cannot be accepted.

## State transitions

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SENT` → `ACCEPTED` or `REJECTED`; sent quotations may expire; replacement marks previous as `SUPERSEDED`.

## Database tables

`quotations`, `quotation_items`, `diagnoses`, `parts`, `repair_tickets`, and `ticket_status_history`.

## Transactions

Required for create plus items/version supersession, approval, send plus ticket status, and customer response plus ticket status.

## Dependencies

Diagnoses, repair tickets, inventory availability, notifications, and audit logs.

## Common errors

Diagnosis not approved, invalid totals, stale version, quotation expired, wrong owner, and invalid status transition.

## Security considerations

Recalculate totals server-side from validated items. Never trust client totals, prices outside authorized manager workflows, or customer IDs from the request.
