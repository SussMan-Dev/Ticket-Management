# Business rules

## Authentication and accounts

- Only customers self-register; administrators create staff accounts.
- Passwords use bcrypt and never leave the authentication boundary. Refresh tokens are stored only as SHA-256 hashes and rotate under a row lock.
- Access authorization requires a valid signed token plus an active database session and active, non-deleted, non-temporarily-locked user.
- Login failures are generic. IP rate limiting and account failed-attempt tracking apply together.
- Refresh-token replay revokes the affected session and creates an audit event.
- Role or non-active status changes revoke all target sessions. The final active administrator cannot be disabled or demoted.

## Ownership and authorization

- Customers may access only their own profile, devices, tickets, quotations, invoices, delivery, and review.
- Technicians may modify only tickets with an active assignment to them unless a manager-authorized workflow says otherwise.
- Receptionists receive devices and record delivery; they do not diagnose, approve quotations, or move stock.
- Inventory staff own stock movements and fulfillment. Cashiers own payments. Managers own assignments, quotation approval, exceptions, and reports. Admins manage accounts and configuration, not routine business data.
- Role checks in middleware never replace resource ownership checks in services.

## Customers and devices

- A customer profile belongs one-to-one to a non-deleted user with the `CUSTOMER` role. Staff-created customers require an initial policy-compliant password and are created with profile and audit data in one transaction.
- Customer notes are visible and writable only to receptionists and managers. Customer list results expose only minimal contact fields.
- Customers can list, create, update, and soft-delete only their own devices. Receptionists and managers may perform those operations for intake; staff must select the target customer explicitly.
- New devices require an active customer, an active category, and, when provided, an active brand. Serial number and IMEI are identifiers, never authorization evidence.
- Device deletion sets `deleted_at`; it never removes the row or future ticket history.

## Ticket lifecycle

- Every transition must appear in `ALLOWED_TICKET_TRANSITIONS`, be permitted for the actor, and write `ticket_status_history` in the same transaction.
- A customer-created ticket begins as `NEW`; an in-store ticket may be created and received as one transaction.
- Ticket codes are unique and use the form `RT-YYYY-NNNNNN`.
- Terminal states are `CLOSED` and `CANCELLED`; history is never deleted.
- Customers may edit/cancel only their own `NEW` ticket and cannot set priority, expected dates, or received state. Technicians see only tickets with an active assignment.
- Repair Tickets permits direct receive, cancellation, and manager hold/resume between `RECEIVED` and `ON_HOLD`. Phase 5 assignment/diagnosis transitions run only through their owning services; later workflow transitions cannot be invoked early through the generic status endpoint.
- Ticket attachments store validated HTTP(S) metadata. Type permissions are role-specific, and no attachment may be added to a terminal ticket.

## Assignments and diagnosis

- A ticket has at most one active assignment. Reassignment closes the old assignment and creates a new record atomically.
- Inactive, administratively locked, temporarily locked, deleted, and non-technician users cannot receive work.
- Phase 5 reassignment is limited to `ASSIGNED` tickets so an existing authored diagnosis cannot be stranded during handoff.
- Only the active assigned diagnosis author writes or submits a diagnosis. Submitted diagnoses are immutable until a manager requests revision; manager approval is audited.
- Requested diagnosis parts must be active and use positive, unique quantities. Customer reads include approved diagnoses only and omit internal root-cause, risk-note, staff-identity, and part-note fields.

## Quotations

- Quotation item descriptions, quantities, and unit prices are snapshots.
- Versions are unique per ticket. Creating a replacement supersedes the previous active quotation.
- Initial quotation items consume an approved diagnosis. Catalog part descriptions/prices and all line/header totals are server-authoritative; tax and discount remain zero until configured policy exists.
- Only a manager-approved quotation with a future expiry may be sent. Only the owning customer may accept or reject it while sent and unexpired.
- Acceptance moves the ticket to parts waiting when part lines exist, otherwise repair; rejection records `CUSTOMER_REJECTED`. Materialized expiry returns the ticket to `WAITING_FOR_QUOTATION` with status history.

## Inventory

- Stock may never be negative. A balance update and its `inventory_transactions` record are atomic.
- New parts start with zero stock; all balance changes flow through an immutable movement with server-calculated before/after values.
- Inventory staff own catalog mutations, stock-in, signed adjustments with mandatory reasons, request decisions, and fulfillment. Managers have read-only visibility; technicians see the active catalog without purchase prices.
- Only the active assigned technician may create a request, using active unique parts and positive quantities, while the ticket is `WAITING_FOR_PARTS` or `REPAIRING`.
- Creating a request during repair atomically returns the ticket to `WAITING_FOR_PARTS`. Fully fulfilling the last open request atomically resumes it to `REPAIRING`.
- Fulfillment may be partial, but it cannot exceed the outstanding requested quantity or available stock. Request items, part balances, movement history, ticket history, notifications, and audit records are not overwritten.
- Phase 7 exposes no return or request-cancellation endpoint; those reserved schema states require a later explicit workflow.

## Payments and delivery

- Cumulative valid payments cannot exceed the invoice total. Completed payments are not edited; corrections use a controlled refund/adjustment workflow.
- Invoice balance and payment rows change in one transaction.
- Delivery normally requires full payment. A manager exception must be explicit and audited.
- A delivered or closed ticket can receive exactly one review from its owning customer, with ratings from 1 to 5.

## Audit and retention

Sensitive actions—role/status changes, assignments, approvals, inventory movement, payment/refund, and delivery exceptions—must create audit records. Financial, inventory, status, assignment, and audit history is never hard-deleted.
