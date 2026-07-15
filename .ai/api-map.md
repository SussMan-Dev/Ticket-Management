# API Map

Base URL: `/api/v1`. Phases 1 through 10 are implemented.

## Health

| Method and path | Roles | Transaction | Status |
|---|---|---|---|
| `GET /health` | Public | No | Implemented |

- Handler: inline foundation handler in `src/routes/index.ts` using `sendSuccess`.
- Tables/repositories: none; this is process liveness, not database readiness.
- Rule: must remain usable in app tests without a MySQL connection.

## Auth

Status: implemented in Phase 2. Access uses Bearer JWT plus database session validation; refresh uses a scoped HttpOnly cookie.

Controller/service/repository: `authController`, `authService`, `authRepository`. Tables: `roles`, `users`, `customer_profiles`, `auth_sessions`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `POST /auth/register` | Public | Yes | 2 |
| `POST /auth/login` | Public, rate-limited | Yes (session create) | 2 |
| `POST /auth/refresh-token` | Valid refresh session | Yes | 2 |
| `POST /auth/logout` | Authenticated/session | Yes | 2 |
| `POST /auth/logout-all` | Authenticated | Yes | 2 |
| `GET /auth/me` | Authenticated | No | 2 |

Rules: only customer self-registration; generic credential errors; hash password and refresh token; refresh always rotates; never return hashes; inactive/locked users cannot authenticate or refresh.

## Users

Status: implemented in Phase 2 and extended with validated avatar upload. List/detail/create/status/role require `ADMIN`; safe profile and avatar updates permit self or admin.

Controller/service/repository: `userController`, `userService`, `userRepository`. Tables: `users`, `roles`, `auth_sessions`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /users` | ADMIN | No | 2 |
| `GET /users/:id` | ADMIN | No | 2 |
| `POST /users` | ADMIN | Yes | 2 |
| `PATCH /users/:id` | ADMIN; self for safe fields | Usually no | 2 |
| `POST /users/:id/avatar` | ADMIN; self | DB transaction plus guarded file replacement | Extension |
| `PATCH /users/:id/status` | ADMIN | Yes | 2 |
| `PATCH /users/:id/role` | ADMIN | Yes | 2 |

Rules: explicit safe columns, bounded pagination/sort whitelist, staff-only creation, audit profile/role/status changes, revoke sessions as policy requires. Avatar upload accepts only configured-size JPEG/PNG/WebP bytes whose signatures match the MIME type, stores a random filename, and removes the prior locally managed image only after the database transaction succeeds.

## Customers

Status: implemented in Phase 3. List/search is staff-only; detail/update enforce customer ownership in the service. Staff-created customers are written with their profile and audit record in one transaction.

Controller/service/repository: `customerController`, `customerService`, `customerRepository`. Tables: `users`, `customer_profiles`, with read joins to devices/tickets.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /customers` | RECEPTIONIST, MANAGER | No | 3 |
| `GET /customers/:id` | Own customer, RECEPTIONIST, MANAGER | No | 3 |
| `POST /customers` | RECEPTIONIST, MANAGER | Yes | 3 |
| `PATCH /customers/:id` | Own customer, RECEPTIONIST, MANAGER | Yes | 3 |
| `GET /customers/:id/tickets` | Own customer, RECEPTIONIST, MANAGER | No | 4 |
| `GET /customers/:id/devices` | Own customer, RECEPTIONIST, MANAGER | No | 3 |

Request notes: `POST /customers` requires `fullName`, `email`, and a policy-compliant initial `password`; `phone`, `address`, and staff-only `notes` are optional. `PATCH /customers/:id` accepts `fullName`, `phone`, `address`, and staff-only `notes`. Customer list supports bounded pagination, search, status, and whitelisted sorting.

Rules: one customer profile per customer-role user; own-resource checks for customer; staff lookup returns minimal contact fields; customer responses never include staff notes. Ticket collection is implemented through the Repair Tickets service in Phase 4.

## Devices

Status: implemented in Phase 3. Catalog endpoints expose active references needed by device creation; catalog administration remains out of scope.

Controller/service/repository: `deviceController`, `deviceService`, `deviceRepository`. Tables: `devices`, `device_categories`, `device_brands`, `users`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /devices` | Own CUSTOMER, RECEPTIONIST, MANAGER | No | 3 |
| `GET /devices/:id` | Owner, RECEPTIONIST, MANAGER | No | 3 |
| `POST /devices` | CUSTOMER (own), RECEPTIONIST, MANAGER | Yes | 3 |
| `PATCH /devices/:id` | Owner, RECEPTIONIST, MANAGER | Yes | 3 |
| `DELETE /devices/:id` | Owner, RECEPTIONIST, MANAGER | Yes (soft delete) | 3 |
| `GET /devices/categories` | CUSTOMER, RECEPTIONIST, MANAGER | No | 3 |
| `GET /devices/brands` | CUSTOMER, RECEPTIONIST, MANAGER | No | 3 |

Request notes: device list supports bounded pagination, model/serial/IMEI search, optional staff `customerId` filtering, and whitelisted sorting. Staff must provide `customerId` when creating a device; a customer is always scoped to the authenticated user regardless of request data.

Rules: verify customer ownership; require an active customer for creation; require active category/brand references when selected; deleted devices cannot create new tickets; preserve linked history. Catalog reads return active entries only.

## Repair Tickets

Status: implemented through Phase 10 for intake CRUD, ticket-owned repair addresses, visibility, receive, hold/resume, cancellation, status history, URL metadata and raw local image attachments, assignment integration, the complete aggregated timeline, and cashier completed-ticket lookup. Downstream workflow transitions remain owned by their modules.

Controller/service/repository: `repairTicketController`, `repairTicketService`, `repairTicketRepository`. Core tables: `repair_tickets`, `ticket_status_history`, `ticket_attachments`; assignment endpoints also use `ticket_assignments`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets` | CUSTOMER own, operational staff by role | No | 4 |
| `GET /repair-tickets/:id` | Owner/assigned/authorized staff | No | 4 |
| `POST /repair-tickets` | CUSTOMER, RECEPTIONIST, MANAGER | Yes | 4 |
| `PATCH /repair-tickets/:id` | Owner for allowed NEW fields; RECEPTIONIST/MANAGER by state | Yes | 4 |
| `POST /repair-tickets/:id/receive` | RECEPTIONIST | Yes | 4 |
| `POST /repair-tickets/:id/assign` | MANAGER | Yes | 5 (implemented) |
| `POST /repair-tickets/:id/reassign` | MANAGER | Yes | 5 (implemented) |
| `GET /repair-tickets/assignable-technicians` | MANAGER | No | 5/10 integration |
| `POST /repair-tickets/:id/change-status` | MANAGER hold/resume in Phase 4; owning workflow role later | Yes | 4+ |
| `POST /repair-tickets/:id/cancel` | Owner in allowed state, MANAGER | Yes | 4 |
| `GET /repair-tickets/:id/status-history` | Same visibility as ticket | No | 4 |
| `GET /repair-tickets/:id/attachments` | Same visibility as ticket | No | 4 |
| `POST /repair-tickets/:id/attachments` | Owner, RECEPTIONIST, assigned TECHNICIAN, MANAGER by type | Yes | 4 |
| `POST /repair-tickets/:id/attachment-files` | Owner, RECEPTIONIST, assigned TECHNICIAN, MANAGER by type | File write then transaction | Extended |
| `GET /repair-tickets/:id/timeline` | Same visibility as ticket | No | 8 |

Request notes: list supports bounded pagination, search, status/priority/customer/device filters, and whitelisted sorting. Customers are always owner-scoped; technicians are always active-assignment-scoped. Staff creation requires `customerId`; every create requires `repairAddress`; only a receptionist may set `receiveNow=true`. Raw attachment upload uses JPEG/PNG/WebP bytes plus `attachmentType` and safe `fileName` query fields, with the same role/type rules as metadata creation. Attachment URLs must use HTTP(S), and filename/MIME metadata is validated.

Rules: customer device ownership; active customer/device/category for creation; unique `RT-YYYY-NNNNNN` code; validated transition map; actor-specific permission; lock current row and append history atomically; technicians require active assignment. Manager status changes remain limited to `RECEIVED <-> ON_HOLD`; implemented assignment/diagnosis and future quotation/repair/payment/delivery transitions cannot be bypassed through the generic endpoint.

## Diagnoses

Status: implemented in Phase 5 with assignment/author scoping, active requested-part validation, ticket row locks/history, durable notifications, approval audit, and approved-only customer-safe serialization.

Controller/service/repository: `diagnosisController`, `diagnosisService`, `diagnosisRepository`. Tables: `diagnoses`, `diagnosis_parts`, `ticket_assignments`, `repair_tickets`, `ticket_status_history`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/diagnoses` | Owner read-safe, assigned TECHNICIAN, MANAGER | No | 5 |
| `POST /repair-tickets/:ticketId/diagnoses` | Assigned TECHNICIAN | Yes if status starts diagnosing | 5 |
| `PATCH /diagnoses/:id` | Assigned author in editable state | No | 5 |
| `POST /diagnoses/:id/submit` | Assigned TECHNICIAN | Yes | 5 |
| `POST /diagnoses/:id/request-revision` | MANAGER | Yes | 5 |
| `POST /diagnoses/:id/approve` | MANAGER | Yes | 5 |

Rules: active assigned author; one open diagnosis per ticket; state-bound editing; non-negative costs and positive unique part quantities; create/submit/revision own the matching ticket transition and history atomically; approval remains at `WAITING_FOR_QUOTATION`; customer sees approved safe fields only.

## Quotations

Status: implemented in Phase 6 with approved-diagnosis snapshots, server-owned catalog pricing/totals, version supersession, expiry, ownership/assignment scoping, notifications, audit, and atomic ticket history.

Controller/service/repository: `quotationController`, `quotationService`, `quotationRepository`. Tables: `quotations`, `quotation_items`, `diagnoses`, `parts`, `repair_tickets`, `ticket_status_history`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/quotations` | Owner, assigned TECHNICIAN, MANAGER | No | 6 |
| `GET /quotations/:id` | Owner, assigned TECHNICIAN, MANAGER | No | 6 |
| `POST /repair-tickets/:ticketId/quotations` | MANAGER | Yes | 6 |
| `PATCH /quotations/:id` | MANAGER, draft only | Yes for item replacement | 6 |
| `POST /quotations/:id/submit` | MANAGER | Yes | 6 |
| `POST /quotations/:id/approve` | MANAGER | Yes | 6 |
| `POST /quotations/:id/send` | MANAGER | Yes | 6 |
| `POST /quotations/:id/accept` | Owning CUSTOMER | Yes | 6 |
| `POST /quotations/:id/reject` | Owning CUSTOMER | Yes | 6 |

Rules: approved diagnosis; server-generated initial items; catalog-owned PART prices; server totals; unique version; supersede prior open quote; future expiry before sending; owner response only while sent and unexpired; transition ticket/history atomically. Accepted quotes move to parts waiting when they contain part lines, otherwise repair; rejected quotes move to customer rejected; materialized expiry returns to quotation waiting.

## Parts and Inventory

Status: implemented in Phase 7 with role-safe catalog reads, audited catalog/stock mutations, immutable movement history, assigned-technician requests, partial fulfillment, and atomic ticket history.

Controllers/services/repositories: `part*` and `inventory*`. Tables: `parts`, `part_requests`, `part_request_items`, `inventory_transactions`, plus tickets/users.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /parts` | TECHNICIAN read, INVENTORY_STAFF, MANAGER | No | 7 |
| `GET /parts/:id` | TECHNICIAN read, INVENTORY_STAFF, MANAGER | No | 7 |
| `POST /parts` | INVENTORY_STAFF | Yes | 7 |
| `PATCH /parts/:id` | INVENTORY_STAFF | Yes | 7 |
| `POST /parts/:id/stock-in` | INVENTORY_STAFF | Yes | 7 |
| `POST /parts/:id/adjust-stock` | INVENTORY_STAFF | Yes | 7 |
| `GET /parts/:id/transactions` | INVENTORY_STAFF, MANAGER | No | 7 |
| `POST /repair-tickets/:ticketId/part-requests` | Assigned TECHNICIAN | Yes | 7 |
| `GET /part-requests` | INVENTORY_STAFF, MANAGER; technician own | No | 7 |
| `GET /part-requests/:id` | INVENTORY_STAFF, MANAGER, requesting technician | No | 7 |
| `POST /part-requests/:id/approve` | INVENTORY_STAFF | Yes | 7 |
| `POST /part-requests/:id/fulfill` | INVENTORY_STAFF | Yes | 7 |
| `POST /part-requests/:id/reject` | INVENTORY_STAFF | Yes | 7 |

Rules: new parts start at zero balance; technician reads omit purchase prices; request lines use positive quantities and active unique parts; technicians require active assignment and own-request scope; lock stock rows in stable order; no negative balance; movement and balance are atomic; partial fulfillment is bounded by outstanding request and availability; every signed adjustment has actor/reason; ticket/history changes are atomic. Phase 7 exposes no return or cancellation endpoint.

## Repair Logs and Testing

Status: implemented in Phase 8 with active-assignee writes, immutable completed logs, fulfilled-part attribution, append-only tests, guarded technical completion/rework, audit/notification, and sanitized timeline reads.

Controller/service/repository: `repairActionController`, `repairActionService`, `repairActionRepository`. Tables: `repair_logs`, `repair_log_parts`, `test_results`, inventory and ticket history.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/repair-logs` | Owner safe view, assigned TECHNICIAN, MANAGER | No | 8 |
| `POST /repair-tickets/:ticketId/repair-logs` | Assigned TECHNICIAN | Yes when parts consumed | 8 |
| `PATCH /repair-logs/:id` | Assigned author while editable | Usually no | 8 |
| `GET /repair-tickets/:ticketId/test-results` | Owner safe view, assigned TECHNICIAN, MANAGER | No | 8 |
| `POST /repair-tickets/:ticketId/test-results` | Assigned TECHNICIAN | Yes when testing starts | 8 |
| `POST /repair-tickets/:ticketId/complete-testing` | Assigned TECHNICIAN | Yes | 8 |

Rules: active assigned author; `REPAIRING`-only log mutation; non-null finish makes log/parts immutable; cumulative part attribution is bounded by fulfilled ticket quantities and never decrements stock twice; tests require a finished log and are append-only; the first test starts `TESTING`; newest normalized named results must all pass for `COMPLETED`, otherwise completion returns to `REPAIRING`; status/history/notification/audit are atomic; customer reads are sanitized.

## Invoices and Payments

Status: implemented in Phase 9 with server-calculated quotation snapshots, locked balances, partial/full collection, immutable payment history, manager-approved whole-payment refunds, audit/notification, and guarded delivery readiness.

Controller/service/repository: `paymentController`, `paymentService`, `paymentRepository` including invoice operations. Tables: `invoices`, `payments`, `repair_tickets`, `ticket_status_history`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /invoices` | CASHIER, MANAGER; customer own through filter | No | 9 |
| `GET /invoices/:id` | CASHIER, MANAGER, owning CUSTOMER | No | 9 |
| `POST /repair-tickets/:ticketId/invoices` | CASHIER | Yes | 9 |
| `GET /invoices/:id/payments` | CASHIER, MANAGER, owning CUSTOMER | No | 9 |
| `POST /invoices/:id/payments` | CASHIER | Yes | 9 |
| `GET /payments/refund-approvers` | CASHIER | No | 9 |
| `POST /payments/:id/refund` | CASHIER with MANAGER approval | Yes | 9 |

Rules: one invoice per locked `COMPLETED` ticket; accepted-quotation totals only; payment precision and balance checked in cents under ticket/invoice locks; no overpayment; completed payment fields remain immutable; whole-payment refund requires a distinct active manager and reason; full payment sets `READY_FOR_DELIVERY`, while a pre-delivery refund restores `COMPLETED`; all financial/status/history/notification/audit writes are atomic.

## Notifications

Status: implemented in Phase 10. All reads and mutations are scoped by the authenticated recipient ID.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /notifications` | Authenticated recipient | No | 10 |
| `GET /notifications/unread-count` | Authenticated recipient | No | 10 |
| `PATCH /notifications/:id/read` | Owning recipient | No | 10 |
| `POST /notifications/read-all` | Authenticated recipient | No | 10 |

Rules: pagination is bounded; optional read-state filter is validated; cross-recipient IDs return not found; marking read is idempotent; content must not contain secrets or internal-only notes.

## Delivery

Status: implemented in Phase 10 with locked single handover, proof metadata, payment enforcement, audited Manager exceptions, customer notification, and final closure.

Controller/service/repository: `deliveryController`, `deliveryService`, `deliveryRepository`. Tables: `deliveries`, `repair_tickets`, `invoices`, `ticket_status_history`, `ticket_attachments`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `POST /repair-tickets/:ticketId/deliver` | RECEPTIONIST; MANAGER exception | Yes | 10 |
| `GET /repair-tickets/:ticketId/delivery` | Owning CUSTOMER, RECEPTIONIST, MANAGER | No | 10 |
| `POST /repair-tickets/:ticketId/close` | RECEPTIONIST, MANAGER | Yes | 10 |

Rules: ticket ready, normally fully paid, not previously delivered; actor/recipient/time required; validated proof URL; manager exception explicit and audited; closure requires both `DELIVERED` state and the persisted delivery record.

## Reviews

Status: implemented in Phase 10 with owner/state/uniqueness enforcement and audited writes.

Controller/service/repository: `reviewController`, `reviewService`, `reviewRepository`. Tables: `reviews`, `repair_tickets`, `users`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `POST /repair-tickets/:ticketId/review` | Owning CUSTOMER | Yes | 10 |
| `GET /repair-tickets/:ticketId/review` | Owner, authorized staff | No | 10 |
| `PATCH /reviews/:id` | Owning CUSTOMER within 7 days | Yes | 10 |

Rules: ticket delivered/closed; exactly one review; ratings 1–5; cross-owner access forbidden.

## Reports

Status: implemented in Phase 10 with bounded UTC ranges and role-specific read-only aggregates.

Controller/service/repository: `reportController`, `reportService`, `reportRepository`. Tables vary by report and are read-only.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /reports/dashboard` | MANAGER | No | 10 |
| `GET /reports/tickets-by-status` | MANAGER | No | 10 |
| `GET /reports/revenue` | MANAGER | No | 10 |
| `GET /reports/technician-performance` | MANAGER | No | 10 |
| `GET /reports/repair-time` | MANAGER | No | 10 |
| `GET /reports/parts-usage` | MANAGER, INVENTORY_STAFF | No | 10 |
| `GET /reports/low-stock` | MANAGER, INVENTORY_STAFF | No | 10 |

Rules: bounded UTC date ranges, server-owned grouping/sort whitelist, no customer PII, revenue derived from completed payments net of valid refunds.
