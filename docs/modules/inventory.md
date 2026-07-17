# Inventory

## Responsibility

Manage the parts catalog, current balances, stock-in/adjustments, technician part requests, fulfillment, immutable stock history, and low-stock filtering.

## Main entities

Part, part request/item, and inventory transaction.

## Main files

The standard route, controller, service, repository, model, schema, and DTO files under `src/modules/parts/` and `src/modules/inventory/`.

## Public APIs

- `GET /parts` and `GET /parts/:id` for technicians, inventory staff, and managers. Technician reads include active parts only and omit purchase prices.
- `POST /parts` and `PATCH /parts/:id` for inventory staff catalog maintenance. New parts always start at zero stock.
- `POST /parts/:id/stock-in` and `POST /parts/:id/adjust-stock` for inventory staff. Adjustments use a non-zero signed `quantityChange` and require a note.
- `GET /parts/:id/transactions` for inventory staff and managers.
- `POST /repair-tickets/:ticketId/part-requests` for the active assigned technician.
- `GET /part-requests` and `GET /part-requests/:id` for inventory staff and managers, or the requesting technician's own records.
- `POST /part-requests/:id/approve`, `/fulfill`, and `/reject` for inventory staff.

No return or cancellation endpoint is exposed. Both remain reserved for a future explicit workflow that reverses stock and billing consistently.

## Allowed roles

Inventory staff maintain catalog data, move stock, and approve/reject/fulfill requests. Active assigned technicians browse the active catalog and request parts for their own tickets. Managers have read-only operational visibility. Other roles have no Parts or Inventory API access.

## Business rules

- A new request is allowed only while its ticket is `WAITING_FOR_PARTS` or `REPAIRING`, and only for the active assigned technician. Creating one during `REPAIRING` atomically returns the ticket to `WAITING_FOR_PARTS` with status history.
- Request lines use active, unique parts and positive quantities.
- Request creation snapshots each part's current selling price. Approval accepts only `PENDING` requests whose ticket is still waiting for parts; it does not require a supplemental customer quotation. Rejection records the actor, reason, notification, and audit event.
- Fulfillment accepts only `APPROVED` or `PARTIALLY_FULFILLED` requests. Each quantity is positive and cannot exceed either the unfulfilled request quantity or current stock.
- A request remains non-billable until fulfillment. Each quantity actually fulfilled becomes chargeable at the request's immutable unit-price snapshot.
- Partial fulfillment is supported. When a request becomes fully fulfilled and no other open request remains for the ticket, the ticket atomically moves from `WAITING_FOR_PARTS` to `REPAIRING`.
- While the ticket is `WAITING_FOR_PARTS`, the active assigned technician may continue documenting repair work, but testing remains blocked and repair-log part attribution is still limited to quantities already fulfilled by inventory.
- Stock never becomes negative. Every balance change and its immutable `inventory_transactions` row are committed together.
- Part creation cannot inject an opening balance; stock enters only through a recorded movement.
- Repair-log part attribution remains operational evidence and does not control the invoice. Final part charges use inventory-fulfilled quantities and their request-time unit prices.

## State transitions

Request `PENDING -> APPROVED -> PARTIALLY_FULFILLED -> FULFILLED`, with `PENDING -> REJECTED` as the Phase 7 rejection path.

Ticket `REPAIRING -> WAITING_FOR_PARTS` when a new request is created, then `WAITING_FOR_PARTS -> REPAIRING` when warehouse processing has fully fulfilled the final open request.

## Database tables

`parts`, `part_requests`, `part_request_items`, `inventory_transactions`, `repair_tickets`, `ticket_status_history`, `ticket_assignments`, `notifications`, and `audit_logs`.

## Transactions

Required for catalog mutations with audit, stock movements, request creation, approval/rejection, fulfillment, notifications, audit entries, and every related ticket status/history change.

## Dependencies

Repair tickets, active assignments, users, notifications, audit logs, diagnoses, quotations, and future repair actions.

## Common errors

Insufficient stock, inactive or duplicate part, invalid quantity, duplicate request line, over-fulfillment, wrong ticket/request state, missing active assignment, and unauthorized movement.

## Security considerations

Lock ticket, request, request-item, and part balance rows with `FOR UPDATE` where applicable; lock multiple parts in stable ID order; calculate before/after values server-side; require the authenticated actor and a reason for adjustments; never trust client prices, balances, roles, or fulfilled totals.
