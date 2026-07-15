# Current Task

## Goal

Implement Phase 7 Parts and Inventory, including the production frontend catalog and part-request workflows.

## Status

Completed on 2026-07-15.

## Delivered

- Added standard seven-file `parts` and `inventory` backend modules and mounted all Phase 7 catalog, movement-history, ticket-request, approval, rejection, and fulfillment endpoints.
- Added inventory-staff catalog maintenance with zero opening balances, SKU uniqueness, stock-in, signed adjustments with mandatory notes, row locks, immutable movement records, and audit events.
- Added active-assigned-technician part requests with active unique lines, own-request read scope, durable notifications, and atomic `REPAIRING -> WAITING_FOR_PARTS` ticket history when new parts are required.
- Added inventory-owned approval/rejection and partial fulfillment. Fulfillment locks requests/items/parts, never exceeds outstanding quantity or stock, writes `STOCK_OUT` ledger rows, and resumes `WAITING_FOR_PARTS -> REPAIRING` only after no open request remains.
- Added role-safe reads: technicians see active catalog entries without purchase prices, inventory staff manage operations, and managers have read-only visibility.
- Added `/parts` and `/part-requests` frontend workspaces, a ticket-scoped request panel, role navigation/dashboard integration, and typed Query hooks with targeted cache invalidation.
- Replaced raw numeric Part ID inputs in diagnosis and quotation forms with authorized active-catalog selectors.
- Documented that Phase 7 intentionally does not expose return or request-cancellation endpoints; their schema states remain reserved for a later explicit workflow.

## Database

- No schema migration was required; existing `parts`, `part_requests`, `part_request_items`, and `inventory_transactions` tables support Phase 7.
- Real MySQL catalog/request reads plus part creation, row locking, balance update, and ledger insertion were verified inside a transaction and rolled back, leaving no verification fixture.

## Verification

- [x] Backend TypeScript typecheck passed
- [x] Backend production build passed
- [x] All 134 backend tests passed, including 22 new Parts/Inventory service and API tests
- [x] Phase 7 read, write, ledger, and locking queries passed against real MySQL
- [x] Frontend TypeScript typecheck and lint passed
- [x] All 19 frontend tests passed
- [x] Frontend production build passed
- [x] Backend health endpoint and frontend development server return successfully
- [x] SQL remains inside repository files
- [x] Role plus ownership/active-assignment authorization is enforced

## Next

Implement Phase 8 Repair Actions and Testing: assigned-technician work logs, fulfilled-part usage, test results, and guarded repair/testing/completion transitions.
