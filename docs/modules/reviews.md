# Reviews

## Responsibility

Allow one post-delivery service review per repair ticket and controlled owner edits.

## Main entities

Review with overall, technician, and service ratings.

## Main files

Implemented under `src/modules/reviews/` using the standard seven-file module structure.

## Public APIs

Create/get review under a ticket and patch by review ID. Implemented in Phase 10.

## Allowed roles

Only the owning customer creates/updates. Operational staff can read according to feedback policy; managers consume aggregates.

## Business rules

Ticket must be `DELIVERED` or `CLOSED`. Exactly one review per ticket. Ratings range from 1 to 5. The owner may edit within seven days of creation.

## State transitions

No workflow status; create once, then owner edits within the configured policy window.

## Database tables

`reviews`, `repair_tickets`, `users`.

## Transactions

Create/update and their audit evidence are committed in one transaction.

## Dependencies

Repair tickets, customers, assignments for technician context, and reports.

## Common errors

Ticket not delivered, wrong owner, duplicate review, invalid rating, and edit window expired.

## Security considerations

Prevent cross-owner review access and sanitize comments at presentation boundaries to prevent stored XSS.
