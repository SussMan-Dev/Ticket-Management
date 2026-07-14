# Inventory

## Responsibility

Manage parts, stock-in/adjustments, technician part requests, fulfillment, returns, stock history, and low-stock reporting.

## Main entities

Part, part request/item, and inventory transaction.

## Main files

Planned across `src/modules/parts/` and `src/modules/inventory/`, each using the standard seven-file structure.

## Public APIs

Part CRUD, stock-in, adjustment, transaction history; ticket part request creation; request list/detail, approve, fulfill, and reject. Planned for Phase 7.

## Allowed roles

Inventory staff manage catalog and movements. Assigned technicians request parts. Managers view/approve according to policy. Other roles receive read-only cost context where required.

## Business rules

Balances never become negative. Every change creates an immutable transaction. Fulfillment never exceeds request or available stock. Returns restore stock and reference the original issue.

## State transitions

Request `PENDING` → `APPROVED`, `REJECTED`, or `CANCELLED`; approved → `PARTIALLY_FULFILLED` → `FULFILLED`.

## Database tables

`parts`, `part_requests`, `part_request_items`, `inventory_transactions`, and `repair_tickets`.

## Transactions

Always required for stock movements, fulfillment, return, and any related ticket status change.

## Dependencies

Repair tickets, assignments, diagnoses, repair actions, users, and audit logs.

## Common errors

Insufficient stock, inactive part, invalid quantity, over-fulfillment, stale balance, and unauthorized movement.

## Security considerations

Lock part balance rows with `FOR UPDATE`; calculate before/after values server-side; require an actor and reason for adjustments.
