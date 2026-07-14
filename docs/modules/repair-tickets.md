# Repair tickets

## Responsibility

Own ticket creation, retrieval, intake, validated status changes, cancellation, history, attachments, and the aggregated timeline.

## Main entities

Repair ticket, ticket attachment, ticket status history, priority, and ticket status.

## Main files

Implemented under `src/modules/repair-tickets/` using route, controller, service, repository, model, schema, and DTO files.

## Public APIs

Implemented in Phase 4: `GET/POST /repair-tickets`, `GET/PATCH /repair-tickets/:id`, `/receive`, `/change-status`, `/cancel`, `/status-history`, and `GET/POST /attachments`. `GET /customers/:id/tickets` is also implemented through this service. Assignment/reassignment remain Phase 5 and the aggregated timeline remains Phase 8.

## Allowed roles

Customers act on owned tickets; receptionists manage intake and receive; technicians may read only actively assigned tickets; managers see all and may hold/resume or cancel according to state. Admin is not an operational repair role. Billing/inventory context remains deferred to consuming phases.

## Business rules

Generate a unique `RT-YYYY-NNNNNN` code from the inserted ticket identity. Creation requires an active customer-owned, non-deleted device whose category remains active. Customers cannot set priority, SLA dates, another owner, or receive state. Validate every state transition and actor permission. Append history in the same transaction and never overwrite it. Attachments store validated HTTP(S) metadata only; no delete endpoint is exposed.

## State transitions

Defined in `src/common/constants/ticket-status.ts` and explained in `docs/ticket-workflow.md`. Phase 4 directly enables `NEW -> RECEIVED`, configured cancellation, and manager `RECEIVED <-> ON_HOLD`; later transitions require their owning modules.

## Database tables

`repair_tickets`, `ticket_attachments`, and `ticket_status_history`, with timeline reads from assignments, diagnoses, quotations, inventory, repair logs, tests, payments, and delivery.

## Transactions

Required for create plus initial history, intake updates with row locks, every status change, cancellation, and attachment authorization plus insert.

## Dependencies

Customers, devices, assignments, diagnoses, notifications, and audit logs.

## Common errors

Ticket/device not found, ownership mismatch, invalid transition, stale state, forbidden role, and terminal ticket.

## Security considerations

Check ownership/assignment in services. Validate attachment URLs and MIME metadata. Use row locks to prevent concurrent state transitions.
