# Reports

## Responsibility

Provide dashboard, status, revenue, technician performance, repair time, parts usage, and low-stock aggregates.

## Main entities

Read-only aggregate DTOs; reports own no source-of-truth business entity.

## Main files

Planned under `src/modules/reports/` using route/controller/service/repository/model/schema/DTO files.

## Public APIs

`GET /reports/dashboard`, `/tickets-by-status`, `/revenue`, `/technician-performance`, `/repair-time`, `/parts-usage`, and `/low-stock`. Planned for Phase 10.

## Allowed roles

Managers view operational and revenue reports. Inventory staff view parts/low-stock. Cashiers may receive billing reports. Admin access is limited by explicit reporting policy.

## Business rules

Date ranges are bounded and use UTC. Revenue uses completed payments minus valid refunds, not invoice face value. Historical attribution remains stable.

## State transitions

None; reports are read-only.

## Database tables

Reads ticket history, assignments, repair logs, quotations, inventory transactions, invoices, payments, and reviews as appropriate.

## Transactions

Not normally required; use a consistent read or reporting replica for cross-table snapshots when strict consistency is required.

## Dependencies

All operational modules; no module depends on reports for business writes.

## Common errors

Invalid date range, unsupported grouping, forbidden report, and query timeout.

## Security considerations

Enforce role-specific fields, bounded ranges/pagination, sort/group whitelists, and avoid exposing customer PII in aggregates.
