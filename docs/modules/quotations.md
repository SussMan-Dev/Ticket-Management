# Quotations

## Responsibility

Create versioned quotations from approved diagnoses, snapshot prices, manage manager approval/sending/expiry, and record the owning customer's response.

## Main entities

Quotation and quotation item.

## Main files

`src/modules/quotations/quotation.route.ts`, `quotation.controller.ts`, `quotation.service.ts`, `quotation.repository.ts`, `quotation.model.ts`, `quotation.schema.ts`, and `quotation.dto.ts`.

## Public APIs

- `GET/POST /repair-tickets/:ticketId/quotations`
- `GET/PATCH /quotations/:id`
- `POST /quotations/:id/submit`
- `POST /quotations/:id/approve`
- `POST /quotations/:id/send`
- `POST /quotations/:id/accept`
- `POST /quotations/:id/reject`

## Allowed roles

Managers create, edit, submit, approve, and send. Active assigned technicians have read-only context. The owning customer reads only versions that have been sent and is the only actor that may accept or reject.

## Business rules

- Creation requires a ticket in the quotation stage and its latest approved diagnosis.
- Initial labor and part lines are generated from the approved diagnosis. Part descriptions and current `selling_price` values are read and snapshotted by the server.
- Draft edits may set `LABOR`/`OTHER` descriptions and prices. A `PART` edit sends only active `partId` and quantity; description and price remain server-authoritative.
- Line totals and quotation totals are calculated by the server. Tax and discount remain zero until a separate configured policy exists.
- Version is unique per ticket. A replacement supersedes an existing draft, pending, or approved version.
- Sending requires an approved quotation and a future expiry. A customer response requires the sent, unexpired quotation and ticket ownership.
- Accepting a quotation with part lines moves the ticket to `WAITING_FOR_PARTS`; otherwise it moves to `REPAIRING`. Rejection moves it to `CUSTOMER_REJECTED`.
- Expiry is surfaced on reads and materialized transactionally when a customer responds or a manager creates a replacement. Materialization returns the ticket to `WAITING_FOR_QUOTATION`.

## State transitions

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SENT` → `ACCEPTED` or `REJECTED`. A sent quotation may become `EXPIRED`; a replacement marks an earlier open version `SUPERSEDED`.

## Database tables

`quotations`, `quotation_items`, `diagnoses`, `parts`, `repair_tickets`, `ticket_status_history`, `notifications`, and `audit_logs`.

## Transactions

Required for create plus snapshot items/version supersession, draft item replacement, submit/approval, send plus ticket status/history, expiry materialization, and customer response plus ticket status/history.

## Common errors

Approved diagnosis missing, part unavailable, amount limit exceeded, invalid expiry, wrong owner, quotation expired, and invalid quotation/ticket state.

## Security considerations

All inputs are validated. Client totals and catalog part prices are rejected, customer identity comes from the signed authenticated session, and services check ticket ownership or active assignment in addition to route roles.
