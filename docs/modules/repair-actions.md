# Repair actions

## Responsibility

Record append-only repair work, consumed parts, device tests, and technical completion.

## Main entities

Repair log, repair log part, and test result.

## Main files

Planned under `src/modules/repair-actions/` using the standard seven-file module structure.

## Public APIs

Ticket repair-log list/create/update, ticket test-result list/create, and complete-testing. Planned for Phase 8.

## Allowed roles

Only the active technician writes repair/test records. Managers view all and may return failed work through an approved workflow. Customers see sanitized progress.

## Business rules

Do not overwrite completed repair history. Used parts must correspond to fulfilled inventory. At least the required tests must pass before technical completion.

## State transitions

`REPAIRING` → `TESTING`; passing completion moves to `COMPLETED`; failed testing returns to `REPAIRING`.

## Database tables

`repair_logs`, `repair_log_parts`, `test_results`, `repair_tickets`, `ticket_status_history`, and inventory tables.

## Transactions

Required when log completion consumes parts or when test completion changes ticket status/history.

## Dependencies

Assignments, repair tickets, and inventory.

## Common errors

Wrong assignee, ticket in wrong state, invalid time range, unfulfilled part usage, and failed/missing tests.

## Security considerations

Validate attachment URLs; do not expose internal-only notes or device credentials; enforce assignment at service level.
