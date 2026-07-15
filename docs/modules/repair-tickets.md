# Repair tickets

## Responsibility

Own ticket creation, retrieval, intake, validated status changes, cancellation, history, attachments, and the aggregated timeline.

## Main entities

Repair ticket, ticket attachment, ticket status history, priority, and ticket status.

## Main files

Implemented under `src/modules/repair-tickets/` using route, controller, service, repository, model, schema, and DTO files.

## Public APIs

Implemented in Phase 4: `GET/POST /repair-tickets`, `GET/PATCH /repair-tickets/:id`, `/receive`, `/change-status`, `/cancel`, `/status-history`, and `GET/POST /attachments`. Raw local image upload is available at `POST /repair-tickets/:id/attachment-files`. `GET /customers/:id/tickets` is also implemented through this service. Phase 5 adds assignment/reassignment; Phase 8 exposes the role-sanitized aggregated timeline at `/repair-tickets/:id/timeline` through the Repair Actions integration.

## Allowed roles

Customers act on owned tickets; receptionists manage intake and receive; technicians may read only actively assigned tickets; managers see all and may hold/resume or cancel according to state. Phase 9 lets cashiers list only `COMPLETED` tickets for invoice lookup; it does not grant ticket mutation. Admin is not an operational repair role. Inventory context remains owned by its consuming module.

## Business rules

Generate a unique `RT-YYYY-NNNNNN` code from the inserted ticket identity. Creation requires an active customer-owned, non-deleted device whose category remains active and a repair-address snapshot independent from the customer profile. Legacy rows may remain null; customers can set/correct the address while `NEW`, and receptionists/managers can correct only that field until terminal state. Customers cannot set priority, SLA dates, another owner, or receive state. Validate every state transition and actor permission. Append history in the same transaction and never overwrite it. Attachments support validated HTTP(S) metadata and raw JPEG/PNG/WebP upload with signature/size validation, random server filenames, and cleanup if metadata persistence fails; no delete endpoint is exposed.

## State transitions

Defined in `src/common/constants/ticket-status.ts` and explained in `docs/ticket-workflow.md`. Repair Tickets directly enables `NEW → RECEIVED`, configured cancellation, and manager `RECEIVED ↔ ON_HOLD`. Owning modules now perform Phase 5 assignment/diagnosis, Phase 6 quotation/response, Phase 7 part waiting/resumption, Phase 8 repair/testing, and Phase 9 payment/readiness transitions atomically; later transitions remain unavailable through the generic endpoint.

## Database tables

`repair_tickets`, `ticket_attachments`, and `ticket_status_history`, with timeline reads from assignments, diagnoses, quotations, inventory, repair logs, tests, payments, and delivery.

## Transactions

Required for create plus initial history, intake updates with row locks, every status change, cancellation, and attachment authorization plus insert.

## Dependencies

Customers, devices, assignments, diagnoses, notifications, and audit logs.

## Common errors

Ticket/device not found, ownership mismatch, invalid transition, stale state, forbidden role, and terminal ticket.

## Security considerations

Check ownership/assignment in services before storing an image. Validate attachment URLs, raw MIME type, image signature, size, and filename. Assigned technicians may upload only during/after-repair image types. Use row locks to prevent concurrent state transitions.
