# Quotations

## Responsibility

Create versioned diagnosis estimates, snapshot provisional prices, manage manager approval/sending/expiry, and record the owning customer's repair decision.

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

- Creation requires `WAITING_FOR_QUOTATION` and the latest approved diagnosis. It generates the labor line plus provisional diagnosis parts at current catalog selling prices.
- The estimate is used only for the customer decision to proceed. Repair-time part requests do not create supplemental quotation versions.
- Draft edits may adjust `LABOR`, `OTHER`, and provisional `PART` lines; catalog-owned part prices are always recalculated by the server.
- Line totals and quotation totals are calculated by the server. Tax and discount remain zero until a separate configured policy exists.
- Version is unique per ticket. A replacement supersedes an existing draft, pending, or approved version.
- Sending requires an approved quotation and a future expiry. A customer response requires the sent, unexpired quotation and ticket ownership.
- Accepting the diagnosis estimate moves the ticket to `REPAIRING`, even when it contains provisional part candidates. Those candidates do not create a warehouse request or a fixed part charge. Rejection moves it to `CUSTOMER_REJECTED`.
- Expiry is surfaced on reads and materialized transactionally when a customer responds or a manager creates a replacement. Materialization returns the ticket to `WAITING_FOR_QUOTATION`.

## State transitions

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SENT` → `ACCEPTED` or `REJECTED`. A sent quotation may become `EXPIRED`; a replacement marks an earlier open version `SUPERSEDED`.

The Manager frontend presents the internal `submit → approve → send` sequence as one confirmed “Duyệt và gửi khách hàng” action. It still calls the existing endpoints in order, preserves every server-side authorization/state check, and refreshes the quotation after a partial failure.

## Database tables

`quotations`, `quotation_items`, `diagnoses`, `parts`, `repair_tickets`, `ticket_status_history`, `notifications`, and `audit_logs`.

## Transactions

Required for create plus snapshot items/version supersession, draft item replacement, submit/approval, send plus ticket status/history, expiry materialization, and customer response plus ticket status/history.

## Common errors

Approved diagnosis missing, part unavailable, amount limit exceeded, invalid expiry, wrong owner, quotation expired, and invalid quotation/ticket state.

## Security considerations

All inputs are validated. Client totals and catalog part prices are rejected, customer identity comes from the signed authenticated session, and services check ticket ownership or active assignment in addition to route roles.
