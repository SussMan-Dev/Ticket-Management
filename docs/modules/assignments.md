# Assignments

## Responsibility

Assign and reassign repair tickets while preserving technician assignment history and workload views.

## Main entities

Ticket assignment and active technician workload.

## Main files

Implemented under `src/modules/ticket-assignments/` using the standard seven-file module structure.

## Public APIs

Assignment actions are exposed as `POST /repair-tickets/:id/assign` and `/reassign`. Both are implemented in Phase 5. Workload endpoints remain deferred until an explicit API contract is defined.

## Allowed roles

Managers assign/reassign. Technicians receive durable assignment notifications and view assigned tickets through the active-assignment scope already enforced by Repair Tickets.

## Business rules

Only one active assignment per ticket. Reassignment closes the old row before creating the new row. The technician must have the technician role, an active account, and no current temporary login lock. Phase 5 permits reassignment while the ticket is `ASSIGNED`; later handoff rules must explicitly address diagnosis authorship before widening that boundary.

## State transitions

Ticket `RECEIVED` → `ASSIGNED`; assignment active → inactive on reassign. Assignment history is immutable. Reassignment does not manufacture a same-status ticket transition.

## Database tables

`ticket_assignments`, `repair_tickets`, `users`, `ticket_status_history`, `notifications`, and `audit_logs`.

## Transactions

Always required. Initial assignment writes the assignment, `RECEIVED → ASSIGNED` ticket state/history, technician notification, and audit event atomically. Reassignment closes the prior row, creates the replacement, notifies both technicians, and audits the change atomically.

## Dependencies

Users, repair tickets, and notifications.

## Common errors

Ticket not receivable for assignment, inactive/locked technician, technician role mismatch, duplicate active assignment, missing active assignment, same-technician reassignment, and concurrent reassignment.

## Security considerations

Lock active assignments and ticket rows during change. Never authorize a technician based only on a technician ID in the request.
