# Assignments

## Responsibility

Assign and reassign repair tickets while preserving technician assignment history and workload views.

## Main entities

Ticket assignment and active technician workload.

## Main files

Planned under `src/modules/ticket-assignments/` using the standard seven-file module structure.

## Public APIs

Assignment actions are exposed as `POST /repair-tickets/:id/assign` and `/reassign`; technician workload endpoints will be manager-only. Planned for Phase 5.

## Allowed roles

Managers assign/reassign. Technicians view and accept their active assignments. Other roles may see the current assignee only when their ticket visibility permits it.

## Business rules

Only one active assignment per ticket. Reassignment closes the old row before creating the new row. The technician must have the technician role and an active account.

## State transitions

Ticket `RECEIVED` → `ASSIGNED`; assignment active → inactive on reassign/closure. Assignment history is immutable.

## Database tables

`ticket_assignments`, `repair_tickets`, `users`, `ticket_status_history`, `notifications`, and `audit_logs`.

## Transactions

Always required for assignment/reassignment, ticket status/history, notification, and audit changes.

## Dependencies

Users, repair tickets, and notifications.

## Common errors

Ticket not receivable for assignment, inactive technician, technician role mismatch, duplicate active assignment, and concurrent reassignment.

## Security considerations

Lock active assignments and ticket rows during change. Never authorize a technician based only on a technician ID in the request.
