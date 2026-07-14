# API Map

Base URL: `/api/v1`. Phases 1 through 4 are implemented. Endpoints from later phases remain planned unless their section says otherwise.

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

Status: implemented in Phase 2. List/detail/create/status/role require `ADMIN`; safe profile patch permits self or admin.

Controller/service/repository: `userController`, `userService`, `userRepository`. Tables: `users`, `roles`, `auth_sessions`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /users` | ADMIN | No | 2 |
| `GET /users/:id` | ADMIN | No | 2 |
| `POST /users` | ADMIN | Yes | 2 |
| `PATCH /users/:id` | ADMIN; self for safe fields | Usually no | 2 |
| `PATCH /users/:id/status` | ADMIN | Yes | 2 |
| `PATCH /users/:id/role` | ADMIN | Yes | 2 |

Rules: explicit safe columns, bounded pagination/sort whitelist, staff-only creation, audit role/status changes, revoke sessions as policy requires.

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

Status: implemented in Phase 4 for intake CRUD, visibility, receive, hold/resume, cancellation, status history, and URL-based attachment metadata. Assignment and downstream workflow transitions remain owned by later phases.

Controller/service/repository: `repairTicketController`, `repairTicketService`, `repairTicketRepository`. Core tables: `repair_tickets`, `ticket_status_history`, `ticket_attachments`; assignment endpoints also use `ticket_assignments`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets` | CUSTOMER own, operational staff by role | No | 4 |
| `GET /repair-tickets/:id` | Owner/assigned/authorized staff | No | 4 |
| `POST /repair-tickets` | CUSTOMER, RECEPTIONIST, MANAGER | Yes | 4 |
| `PATCH /repair-tickets/:id` | Owner for allowed NEW fields; RECEPTIONIST/MANAGER by state | Yes | 4 |
| `POST /repair-tickets/:id/receive` | RECEPTIONIST | Yes | 4 |
| `POST /repair-tickets/:id/assign` | MANAGER | Yes | 5 |
| `POST /repair-tickets/:id/reassign` | MANAGER | Yes | 5 |
| `POST /repair-tickets/:id/change-status` | MANAGER hold/resume in Phase 4; owning workflow role later | Yes | 4+ |
| `POST /repair-tickets/:id/cancel` | Owner in allowed state, MANAGER | Yes | 4 |
| `GET /repair-tickets/:id/status-history` | Same visibility as ticket | No | 4 |
| `GET /repair-tickets/:id/attachments` | Same visibility as ticket | No | 4 |
| `POST /repair-tickets/:id/attachments` | Owner, RECEPTIONIST, assigned TECHNICIAN, MANAGER by type | Yes | 4 |
| `GET /repair-tickets/:id/timeline` | Same visibility as ticket | No | 8 |

Request notes: list supports bounded pagination, search, status/priority/customer/device filters, and whitelisted sorting. Customers are always owner-scoped; technicians are always active-assignment-scoped. Staff creation requires `customerId`; only a receptionist may set `receiveNow=true`. Attachment URLs must use HTTP(S), and filename/MIME metadata is validated.

Rules: customer device ownership; active customer/device/category for creation; unique `RT-YYYY-NNNNNN` code; validated transition map; actor-specific permission; lock current row and append history atomically; technicians require active assignment. Phase 4 manager status changes are limited to `RECEIVED <-> ON_HOLD`; assignment/diagnosis/quotation/repair/payment/delivery transitions cannot be bypassed through the generic endpoint.

## Diagnoses

Controller/service/repository: `diagnosisController`, `diagnosisService`, `diagnosisRepository`. Tables: `diagnoses`, `diagnosis_parts`, `ticket_assignments`, `repair_tickets`, `ticket_status_history`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/diagnoses` | Owner read-safe, assigned TECHNICIAN, MANAGER | No | 5 |
| `POST /repair-tickets/:ticketId/diagnoses` | Assigned TECHNICIAN | Yes if status starts diagnosing | 5 |
| `PATCH /diagnoses/:id` | Assigned author in editable state | No | 5 |
| `POST /diagnoses/:id/submit` | Assigned TECHNICIAN | Yes | 5 |
| `POST /diagnoses/:id/request-revision` | MANAGER | Yes | 5 |
| `POST /diagnoses/:id/approve` | MANAGER | Yes | 5 |

Rules: active assignment; state-bound editing; non-negative costs/quantities; submit/approve plus ticket history is atomic; customer sees only approved safe fields.

## Quotations

Controller/service/repository: `quotationController`, `quotationService`, `quotationRepository`. Tables: `quotations`, `quotation_items`, `diagnoses`, `parts`, `repair_tickets`, `ticket_status_history`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/quotations` | Owner, MANAGER, authorized operational roles | No | 6 |
| `GET /quotations/:id` | Owner, MANAGER, authorized operational roles | No | 6 |
| `POST /repair-tickets/:ticketId/quotations` | MANAGER | Yes | 6 |
| `PATCH /quotations/:id` | MANAGER, draft only | Yes for item replacement | 6 |
| `POST /quotations/:id/submit` | Authorized preparer/MANAGER | Yes | 6 |
| `POST /quotations/:id/approve` | MANAGER | Yes | 6 |
| `POST /quotations/:id/send` | MANAGER | Yes | 6 |
| `POST /quotations/:id/accept` | Owning CUSTOMER | Yes | 6 |
| `POST /quotations/:id/reject` | Owning CUSTOMER | Yes | 6 |

Rules: approved diagnosis; server totals; price snapshots; unique version; supersede prior current quote; owner response only while sent and unexpired; transition ticket atomically.

## Parts and Inventory

Controllers/services/repositories: `part*` and `inventory*`. Tables: `parts`, `part_requests`, `part_request_items`, `inventory_transactions`, plus tickets/users.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /parts` | TECHNICIAN read, INVENTORY_STAFF, MANAGER | No | 7 |
| `GET /parts/:id` | TECHNICIAN read, INVENTORY_STAFF, MANAGER | No | 7 |
| `POST /parts` | INVENTORY_STAFF | No | 7 |
| `PATCH /parts/:id` | INVENTORY_STAFF | No | 7 |
| `POST /parts/:id/stock-in` | INVENTORY_STAFF | Yes | 7 |
| `POST /parts/:id/adjust-stock` | INVENTORY_STAFF | Yes | 7 |
| `GET /parts/:id/transactions` | INVENTORY_STAFF, MANAGER | No | 7 |
| `POST /repair-tickets/:ticketId/part-requests` | Assigned TECHNICIAN | Yes | 7 |
| `GET /part-requests` | INVENTORY_STAFF, MANAGER; technician own | No | 7 |
| `GET /part-requests/:id` | INVENTORY_STAFF, MANAGER, requesting technician | No | 7 |
| `POST /part-requests/:id/approve` | INVENTORY_STAFF | Yes | 7 |
| `POST /part-requests/:id/fulfill` | INVENTORY_STAFF | Yes | 7 |
| `POST /part-requests/:id/reject` | INVENTORY_STAFF | Yes | 7 |

Rules: positive quantities; lock stock row; no negative balance; movement and balance atomic; fulfillment bounded by request/availability; every adjustment has actor/reason.

## Repair Logs and Testing

Controller/service/repository: `repairActionController`, `repairActionService`, `repairActionRepository`. Tables: `repair_logs`, `repair_log_parts`, `test_results`, inventory and ticket history.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /repair-tickets/:ticketId/repair-logs` | Owner safe view, assigned TECHNICIAN, MANAGER | No | 8 |
| `POST /repair-tickets/:ticketId/repair-logs` | Assigned TECHNICIAN | Yes when parts consumed | 8 |
| `PATCH /repair-logs/:id` | Assigned author while editable | Usually no | 8 |
| `GET /repair-tickets/:ticketId/test-results` | Owner safe view, assigned TECHNICIAN, MANAGER | No | 8 |
| `POST /repair-tickets/:ticketId/test-results` | Assigned TECHNICIAN | No | 8 |
| `POST /repair-tickets/:ticketId/complete-testing` | Assigned TECHNICIAN | Yes | 8 |

Rules: append/preserve technical history; part usage must be fulfilled; valid time range; required passing tests for completion; failure returns ticket to repair atomically.

## Invoices and Payments

Controller/service/repository: `paymentController`, `paymentService`, `paymentRepository` including invoice operations. Tables: `invoices`, `payments`, `repair_tickets`, `ticket_status_history`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `GET /invoices` | CASHIER, MANAGER; customer own through filter | No | 9 |
| `GET /invoices/:id` | CASHIER, MANAGER, owning CUSTOMER | No | 9 |
| `POST /repair-tickets/:ticketId/invoices` | CASHIER | Yes | 9 |
| `GET /invoices/:id/payments` | CASHIER, MANAGER, owning CUSTOMER | No | 9 |
| `POST /invoices/:id/payments` | CASHIER | Yes | 9 |
| `POST /payments/:id/refund` | CASHIER with MANAGER approval | Yes | 9 |

Rules: one invoice per completed ticket; server totals; lock invoice; no overpayment; completed payments immutable; refunds bounded by completed paid amount and audited.

## Delivery

Controller/service/repository: `deliveryController`, `deliveryService`, `deliveryRepository`. Tables: `deliveries`, `repair_tickets`, `invoices`, `ticket_status_history`, `ticket_attachments`, `audit_logs`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `POST /repair-tickets/:ticketId/deliver` | RECEPTIONIST; MANAGER exception | Yes | 10 |
| `GET /repair-tickets/:ticketId/delivery` | Owning CUSTOMER, RECEPTIONIST, MANAGER | No | 10 |

Rules: ticket ready, normally fully paid, not previously delivered; actor/recipient/time required; validated proof URL; manager exception explicit and audited.

## Reviews

Controller/service/repository: `reviewController`, `reviewService`, `reviewRepository`. Tables: `reviews`, `repair_tickets`, `users`.

| Method and path | Roles | Transaction | Phase |
|---|---|---|---|
| `POST /repair-tickets/:ticketId/review` | Owning CUSTOMER | No | 10 |
| `GET /repair-tickets/:ticketId/review` | Owner, authorized staff | No | 10 |
| `PATCH /reviews/:id` | Owning CUSTOMER within policy | No | 10 |

Rules: ticket delivered/closed; exactly one review; ratings 1–5; cross-owner access forbidden.

## Reports

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
