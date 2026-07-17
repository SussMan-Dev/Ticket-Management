# Business rules

## Authentication and accounts

- Only customers self-register; administrators create staff accounts.
- Passwords use bcrypt and never leave the authentication boundary. Refresh tokens are stored only as SHA-256 hashes and rotate under a row lock.
- Access authorization requires a valid signed token plus an active database session and active, non-deleted, non-temporarily-locked user.
- Login failures are generic. IP rate limiting and account failed-attempt tracking apply together.
- Refresh-token replay revokes the affected session and creates an audit event.
- Role or non-active status changes revoke all target sessions. The final active administrator cannot be disabled or demoted.
- Avatar uploads are self- or Admin-scoped, accept only signature-validated JPEG/PNG/WebP images up to the configured size, use random server filenames, and never trust a client file path.

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
- Every new ticket snapshots a required repair address independently from the customer's profile address. Customers may change it only while `NEW`; receptionists and managers may correct only this address until the ticket becomes terminal so legacy tickets can be completed accurately.
- Repair Tickets permits direct receive, cancellation, and manager hold/resume between `RECEIVED` and `ON_HOLD`. Phase 5 assignment/diagnosis transitions run only through their owning services; later workflow transitions cannot be invoked early through the generic status endpoint.
- Ticket attachments may store validated HTTP(S) metadata or generated URLs for raw JPEG/PNG/WebP uploads. Raw images are size/signature validated and use random server filenames. Type permissions are role-specific, assigned technicians are limited to during/after-repair images, and no attachment may be added to a terminal ticket.

## Assignments and diagnosis

- A ticket has at most one active assignment. Reassignment closes the old assignment and creates a new record atomically.
- Inactive, administratively locked, temporarily locked, deleted, and non-technician users cannot receive work.
- Phase 5 reassignment is limited to `ASSIGNED` tickets so an existing authored diagnosis cannot be stranded during handoff.
- Only the active assigned diagnosis author writes or submits a diagnosis. Submitted diagnoses are immutable until a manager requests revision; manager approval is audited.
- Diagnosis parts are provisional repair candidates only: they must be active and use positive, unique quantities. They may appear in the diagnosis estimate, but they do not request stock and their estimated quantities are not copied into the final invoice. Customer reads include approved diagnoses only and omit internal root-cause, risk-note, staff-identity, and part-note fields.

## Quotations

- Quotation item descriptions, quantities, and unit prices are snapshots.
- Versions are unique per ticket. Creating a replacement supersedes the previous active quotation.
- The diagnosis quotation is an estimate containing approved labor/service lines and provisional diagnosis parts at catalog selling prices. It helps the customer decide whether to proceed; it is not a fixed final invoice.
- Repair-time part requests do not create supplemental quotations. Their selling prices are snapshotted on the request and warehouse staff independently approve and fulfill them.
- Only a manager-approved quotation with a future expiry may be sent. Only the owning customer may accept or reject it while sent and unexpired.
- Acceptance authorizes repair and moves the ticket to `REPAIRING`; provisional part lines never trigger inventory waiting. Rejection records `CUSTOMER_REJECTED`. Materialized expiry returns the ticket to `WAITING_FOR_QUOTATION` with status history.

## Inventory

- Stock may never be negative. A balance update and its `inventory_transactions` record are atomic.
- New parts start with zero stock; all balance changes flow through an immutable movement with server-calculated before/after values.
- Inventory staff own catalog mutations, stock-in, signed adjustments with mandatory reasons, request decisions, and fulfillment. Managers have read-only visibility; technicians see the active catalog without purchase prices.
- Only the active assigned technician may create a request, using active unique parts and positive quantities, while the ticket is `WAITING_FOR_PARTS` or `REPAIRING`.
- Creating a request during repair atomically returns the ticket to `WAITING_FOR_PARTS`. Fully fulfilling the last open request atomically resumes it to `REPAIRING`.
- Creating a part request snapshots the current selling price but does not yet create a customer charge. Inventory staff approve the technical stock request without requiring another customer quotation; only the quantity actually fulfilled by inventory becomes chargeable.
- Fulfillment may be partial, but it cannot exceed the outstanding requested quantity or available stock. Request items, part balances, movement history, ticket history, notifications, and audit records are not overwritten.
- No return or request-cancellation endpoint is exposed. A future return workflow must explicitly reverse both stock and billing effects; testing does not silently return or remove fulfilled parts from the invoice.

## Repair and testing

- Only the active assigned technician writes repair logs and test results. Managers are read-only; customers receive sanitized progress and result views for their own tickets.
- Repair logs may be created and edited by the active assigned technician while the ticket is `REPAIRING` or `WAITING_FOR_PARTS`. This lets work already performed be recorded while a supplemental part request is pending. Once `finished_at` is set, the log and its part attribution are immutable.
- Repair-log part quantities attribute stock already fulfilled for the ticket; they never decrement inventory again, and cumulative attributed usage cannot exceed cumulative fulfillment.
- Tests remain unavailable while a ticket is `WAITING_FOR_PARTS`; they require the ticket to return to `REPAIRING`, at least one finished repair log, and no unfinished repair logs. Results are append-only, and recording the first test of a round moves `REPAIRING` to `TESTING` atomically.
- With no configured test catalog, the latest result for each normalized test name defines the completion gate. All must pass for `COMPLETED`; any latest failure returns the ticket to `REPAIRING`.
- Technical completion sets the ticket completion timestamp, appends status history, notifies the customer, and creates an audit record in the same transaction.

## Payments and delivery

- A locked `COMPLETED` ticket may receive exactly one invoice. Labor/other lines come from the accepted diagnosis estimate. Provisional quotation part lines are excluded; the part subtotal uses quantities actually fulfilled by inventory during repair and the immutable unit prices snapshotted on their technician requests.
- Cashiers may preview the complete server-derived cost breakdown before issuing an invoice. The preview never accepts client totals and invoice creation recalculates the same lines under the ticket transaction; invoice detail exposes the breakdown for authorized readers.
- Cumulative valid payments cannot exceed the invoice total. Amounts use two-decimal cent comparisons under an invoice lock.
- Completed payment amount, method, reference, receiver, and time are not edited. A correction refunds one whole completed payment by changing only its status to `REFUNDED`.
- Refund requires a distinct active manager approval identity and reason, is bounded by the locked valid paid amount, and records cashier/manager/before-after evidence in audit.
- Invoice balance, payment/refund, ticket status/history, notification, and audit rows change in one transaction.
- Full payment moves `COMPLETED → READY_FOR_DELIVERY`; a refund before delivery moves `READY_FOR_DELIVERY → COMPLETED`.
- Delivery normally requires full payment. A manager exception must be explicit and audited.
- Handover creates one delivery row, optional proof attachment, `DELIVERED` status/history, customer notification, and audit evidence atomically. Final closure requires `DELIVERED` and the persisted delivery row.
- A delivered or closed ticket can receive exactly one review from its owning customer, with ratings from 1 to 5; owner edits expire after seven days.
- Report ranges are server-bounded to 366 days. Finance/operations aggregates are Manager-only; inventory staff receive only parts-usage and low-stock data; revenue derives from valid payment status rather than invoice face value.

## Audit and retention

Sensitive actions—role/status changes, assignments, approvals, inventory movement, payment/refund, and delivery exceptions—must create audit records. Financial, inventory, status, assignment, and audit history is never hard-deleted.
