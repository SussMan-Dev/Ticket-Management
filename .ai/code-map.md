# Code Map

## Frontend Application

Purpose: standalone browser UI for implemented Auth through Diagnosis workflows, plus an isolated Phase 6 quotation adapter boundary.

Main files: `frontend/src/app/`, `frontend/src/features/`, `frontend/src/lib/api/`, `frontend/src/lib/auth/`, `frontend/src/layouts/`, `frontend/src/routes/`, and `frontend/src/components/ui/`.

Configuration and docs: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/eslint.config.js`, `frontend/.env.example`, and `frontend/README.md`.

Read when: changing browser authentication, role navigation, feature pages, frontend API DTOs/hooks, forms, quotation adapter integration, responsive styling, or frontend tests.

Important rules: access tokens stay in memory; refresh uses the HttpOnly cookie; UI role visibility never replaces backend authorization; components do not call `fetch`; Phase 6 remains mock-only until actual backend quotation DTOs exist.

## Foundation

Purpose: runtime configuration, HTTP composition, common contracts, database lifecycle, error handling, validation, logging, and transaction boundaries.

Main files: `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/config/database.ts`, `src/config/jwt.ts`, `src/routes/index.ts`, `src/middlewares/*`, and `src/common/*`.

Database files: `src/database/schema.sql`, `src/database/seeds/001_roles.sql`.

Read when: changing startup, cross-cutting middleware, API envelopes, environment settings, transaction behavior, or shared types.

Important rules: app import must not require a live database; server startup does. Logs redact secret-like keys. JWT config refuses absent or identical secrets when Phase 2 consumes it.

## Auth Module

Purpose: registration, login, token issuance/rotation, session revocation, and current identity.

Main files: `src/modules/auth/auth.route.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.model.ts`, `auth.schema.ts`, `auth.dto.ts`; shared JWT/password/refresh utilities and authentication/rate-limit middleware.

Tables: `users`, `roles`, `auth_sessions`, `customer_profiles`, `audit_logs`.

Dependencies: users, JWT/password utilities, database transactions.

Read when: implementing tokens, credential checks, session rotation, logout, or customer registration.

Important rules: generic credential errors; bcrypt passwords; SHA-256 refresh hashes in HttpOnly cookies; `FOR UPDATE` rotation with unique JWT IDs; replay revokes/audits; database session/user validation on protected requests; IP rate limit plus temporary account lock.

## Users Module

Purpose: safe user queries, staff creation, profile updates, account status, and roles.

Main files: `src/modules/users/user.route.ts`, `user.controller.ts`, `user.service.ts`, `user.repository.ts`, `user.model.ts`, `user.schema.ts`, `user.dto.ts`.

Tables: `users`, `roles`, `auth_sessions`, `audit_logs`.

Dependencies: auth and customer profiles.

Read when: changing staff/user administration or safe user serialization.

Important rules: admin-only staff/role/status changes; safe self profile update; revoke sessions on role/non-active status; protect self and final active admin; audit changes; never select hashes for response queries.

## Customers Module

Purpose: customer profiles, receptionist lookup, and customer ticket/device views.

Main files: `src/modules/customers/customer.route.ts`, `customer.controller.ts`, `customer.service.ts`, `customer.repository.ts`, `customer.model.ts`, `customer.schema.ts`, `customer.dto.ts` (implemented Phase 3).

Tables: `customer_profiles`, `users`; reads `devices`, `repair_tickets`.

Dependencies: users, devices, repair tickets.

Read when: changing customer profile or staff intake lookup.

Important rules: profile user must have `CUSTOMER` role; customers see only themselves.

## Devices Module

Purpose: customer devices and category/brand catalog references.

Main files: `src/modules/devices/device.route.ts`, `device.controller.ts`, `device.service.ts`, `device.repository.ts`, `device.model.ts`, `device.schema.ts`, `device.dto.ts` (implemented Phase 3).

Tables: `devices`, `device_categories`, `device_brands`.

Dependencies: customers and repair tickets.

Read when: device CRUD, catalog lookup, or ownership checks change.

Important rules: owner-only customer access; device/category must be active for new tickets; soft delete preserves ticket history.

## Repair Tickets Module

Purpose: complete repair-ticket lifecycle, retrieval, filters, intake, status history, attachments, and timeline.

Main files: `src/modules/repair-tickets/repair-ticket.route.ts`, `repair-ticket.controller.ts`, `repair-ticket.service.ts`, `repair-ticket.repository.ts`, `repair-ticket.model.ts`, `repair-ticket.schema.ts`, `repair-ticket.dto.ts` (implemented Phase 4).

Tables: `repair_tickets`, `ticket_status_history`, `ticket_attachments`.

Dependencies: users, devices, assignments, notifications, and downstream workflow modules.

Read when: creating/updating tickets, status transitions, ticket filters/timeline, or ownership logic.

Important rules: customers access only owned tickets; technicians require an active assignment; every status change validates transition and writes history in one transaction; use row locks for concurrency. Phase 4 exposes receive, configured cancellation, and manager hold/resume only. Attachment URLs are validated metadata with role-specific types and no destructive delete endpoint.

## Ticket Assignments Module

Purpose: assign/reassign technicians and retain assignment history/workload.

Main files: `src/modules/ticket-assignments/ticket-assignment.route.ts`, `ticket-assignment.controller.ts`, `ticket-assignment.service.ts`, `ticket-assignment.repository.ts`, `ticket-assignment.model.ts`, `ticket-assignment.schema.ts`, `ticket-assignment.dto.ts` (implemented Phase 5).

Tables: `ticket_assignments`, `repair_tickets`, `ticket_status_history`, `users`.

Dependencies: repair tickets, users, notifications.

Read when: assignment, technician authorization, or workload changes.

Important rules: at most one active assignment under a ticket row lock; close old then create new atomically; technician must be active, unlocked, and have the technician role; Phase 5 reassignment is limited to `ASSIGNED` tickets; assignment notifications and audit records share the transaction.

## Diagnoses Module

Purpose: findings, proposed repair, labor/risk, requested parts, submit/revision/approval.

Main files: `src/modules/diagnoses/diagnosis.route.ts`, `diagnosis.controller.ts`, `diagnosis.service.ts`, `diagnosis.repository.ts`, `diagnosis.model.ts`, `diagnosis.schema.ts`, `diagnosis.dto.ts` (implemented Phase 5).

Tables: `diagnoses`, `diagnosis_parts`.

Dependencies: assignments, repair tickets, parts, quotations.

Read when: diagnosis workflow or technician constraints change.

Important rules: active assigned author writes; one open diagnosis per ticket; active unique requested parts; submitted content is immutable until revision; manager revision/approval is audited; customer reads approved safe fields only; owning ticket transitions, history, and notifications are atomic.

## Quotations Module

Purpose: versioned price snapshots, internal approval, sending, expiry, and customer response.

Main files: `src/modules/quotations/quotation.route.ts`, `quotation.controller.ts`, `quotation.service.ts`, `quotation.repository.ts`, `quotation.model.ts`, `quotation.schema.ts`, `quotation.dto.ts` (planned Phase 6).

Tables: `quotations`, `quotation_items`.

Dependencies: diagnoses, repair tickets, parts, customers, notifications.

Read when: quotation totals, versions, expiry, approval, or response changes.

Important rules: server-calculated totals; snapshot unit prices; only approved/sent/unexpired quotation may be accepted by owner; supersede old active version.

## Parts and Inventory Modules

Purpose: part catalog, balances, requests, fulfillment/return, and immutable movement history.

Main files: standard seven files under `src/modules/parts/` and `src/modules/inventory/` (planned Phase 7).

Tables: `parts`, `part_requests`, `part_request_items`, `inventory_transactions`.

Dependencies: repair tickets, assignments, diagnoses, repair actions.

Read when: stock, part pricing, part request, fulfillment, return, or low-stock logic changes.

Important rules: lock balance rows; no negative stock; balance and transaction row are atomic; fulfillment does not exceed request.

## Repair Actions Module

Purpose: repair logs, parts used, test results, and technical completion.

Main files: standard seven files under `src/modules/repair-actions/` (planned Phase 8).

Tables: `repair_logs`, `repair_log_parts`, `test_results`.

Dependencies: assignments, inventory, repair tickets.

Read when: repair progress, part usage, testing, or completion changes.

Important rules: active assignee writes; preserve completed logs; passed tests are required before completion.

## Payments Module

Purpose: invoices, partial/full payments, balances, statuses, and refunds.

Main files: standard seven files under `src/modules/payments/` (planned Phase 9).

Tables: `invoices`, `payments`.

Dependencies: quotations, repair tickets, users, delivery.

Read when: invoice calculation, payment, refund, or delivery readiness changes.

Important rules: one invoice per ticket; no overpayment; completed payment is immutable; balance/status changes are atomic and audited.

## Deliveries Module

Purpose: device handover, recipient/proof, delivery timestamp, and closure.

Main files: standard seven files planned under `src/modules/deliveries/` for Phase 10.

Tables: `deliveries`, `repair_tickets`, `ticket_status_history`, `invoices`.

Dependencies: payments, repair tickets, customers, notifications.

Read when: handover or close-ticket policy changes.

Important rules: normally require full payment; manager exception is explicit/audited; one delivery per ticket.

## Reviews Module

Purpose: post-delivery customer feedback.

Main files: standard seven files under `src/modules/reviews/` (planned Phase 10).

Tables: `reviews`, `repair_tickets`.

Dependencies: customers, repair tickets, reports.

Read when: rating, review ownership, or edit policy changes.

Important rules: one review per ticket; owner only; ticket delivered/closed; ratings 1–5.

## Notifications Module

Purpose: durable user notifications for assignments and ticket milestones.

Main files: standard seven files under `src/modules/notifications/` (planned alongside consuming phases).

Tables: `notifications`.

Dependencies: users and all event-producing modules.

Read when: notification persistence/read status or event mapping changes.

Important rules: do not put secrets or sensitive internal notes in content; authorization is by recipient user ID.

## Reports Module

Purpose: read-only dashboard, revenue, performance, timing, parts usage, and low-stock aggregates.

Main files: standard seven files under `src/modules/reports/` (planned Phase 10).

Tables: read-only access across operational tables.

Dependencies: all source modules; no business module depends on reports for writes.

Read when: metrics definitions, filters, or report access changes.

Important rules: bounded UTC ranges; role-specific reports; revenue uses valid payments minus refunds; no customer PII in aggregates.
