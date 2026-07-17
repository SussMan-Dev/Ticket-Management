# Repair actions

## Responsibility

Record repair work, fulfilled-part attribution, append-only device tests, technical completion, and the aggregated ticket timeline.

## Main entities

Repair log, repair log part, test result, and timeline event.

## Main files

The standard route, controller, service, repository, model, schema, and DTO files under `src/modules/repair-actions/`.

## Public APIs

- `GET/POST /repair-tickets/:ticketId/repair-logs` for scoped reads and active-assigned-technician creation.
- `PATCH /repair-logs/:id` for the active assigned author while the log is unfinished.
- `GET/POST /repair-tickets/:ticketId/test-results` for scoped reads and active-assigned-technician append-only test evidence.
- `POST /repair-tickets/:ticketId/complete-testing` for the active assigned technician.
- `GET /repair-tickets/:ticketId/timeline` for the owning customer, active assigned technician, and manager.

## Allowed roles

Only the active assigned technician writes repair logs, tests, and testing completion. Managers have full read-only visibility. Owning customers receive sanitized repair/test/timeline views without technician identity, repair results, used-part detail, internal notes, or actors where those details are internal.

## Business rules

- Repair logs may be created and edited while the ticket is `REPAIRING` or `WAITING_FOR_PARTS`. The creator must be the active assigned technician, so work already performed can still be documented while a supplemental request is pending.
- `startedAt` defaults server-side. When both timestamps exist, `finishedAt` cannot precede `startedAt`.
- An unfinished log is editable by its author. A non-null `finishedAt` makes the log and its part attribution immutable.
- Repair-log parts do not decrement stock again. They attribute already-issued stock, and cumulative usage for each ticket/part cannot exceed cumulative fulfilled request quantity.
- Testing cannot begin while the ticket is `WAITING_FOR_PARTS`. After the final open request returns it to `REPAIRING`, at least one finished repair log and no unfinished repair log are required before recording or completing tests so technical work history is complete.
- Test results are append-only. The first test recorded from `REPAIRING` atomically moves the ticket to `TESTING` with status history.
- Test names are free-form because the schema has no configured test catalog. For completion, the newest result for each case-insensitive trimmed test name is authoritative.
- Completing testing moves to `COMPLETED` only when every latest named result is `PASS`; otherwise it atomically returns to `REPAIRING`. Successful completion sets `completed_at`, notifies the customer, and is audited. It does not alter fulfilled stock or invoice quantities.

## State transitions

`REPAIRING -> TESTING` when the first result of a testing round is recorded. `TESTING -> COMPLETED` when every latest named test passes. `TESTING -> REPAIRING` when completion finds a latest failed test.

## Database tables

`repair_logs`, `repair_log_parts`, `test_results`, `repair_tickets`, `ticket_status_history`, `ticket_assignments`, `part_requests`, `part_request_items`, `notifications`, and `audit_logs`. Timeline reads also aggregate earlier workflow tables.

## Transactions

Required for every repair-log mutation, part-attribution validation/replacement, the first test plus ticket transition, and testing completion plus status history/notification/audit.

## Dependencies

Active assignments, repair tickets, fulfilled inventory requests, users, notifications, audit logs, and all implemented workflow sources used by the timeline.

## Common errors

Wrong assignee/author, ticket in the wrong state, invalid time range, immutable finished log, unfulfilled or over-attributed part usage, missing finished log, missing tests, and unauthorized customer/technician scope.

## Security considerations

Enforce assignment and customer ownership in the service, lock the ticket before usage/state writes, validate all text/timestamps/quantities, keep tests append-only, sanitize customer views, and never place device credentials or secrets in customer-visible action descriptions.
