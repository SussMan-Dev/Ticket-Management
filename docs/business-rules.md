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
- Only a manager-approved quotation may be sent. Only the owning customer may accept or reject it, and expired quotations cannot be accepted.

## Inventory

- Stock may never be negative. A balance update and its `inventory_transactions` record are atomic.
- Fulfilled quantity cannot exceed requested quantity. Stock history and part usage are not overwritten.

## Payments and delivery

- Cumulative valid payments cannot exceed the invoice total. Completed payments are not edited; corrections use a controlled refund/adjustment workflow.
- Invoice balance and payment rows change in one transaction.
- Delivery normally requires full payment. A manager exception must be explicit and audited.
- A delivered or closed ticket can receive exactly one review from its owning customer, with ratings from 1 to 5.

## Audit and retention

Sensitive actions—role/status changes, assignments, approvals, inventory movement, payment/refund, and delivery exceptions—must create audit records. Financial, inventory, status, assignment, and audit history is never hard-deleted.
