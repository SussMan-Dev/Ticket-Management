# Code Map

## Frontend Application

Purpose: standalone browser UI for the complete Phase 1–10 workflow from authentication/intake through delivery, review, notifications, and reports.

Main files: `frontend/src/app/`, `frontend/src/features/`, `frontend/src/lib/api/`, `frontend/src/lib/auth/`, `frontend/src/layouts/`, `frontend/src/routes/`, and `frontend/src/components/ui/`.

Configuration and docs: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/eslint.config.js`, `frontend/.env.example`, and `frontend/README.md`.

Read when: changing browser authentication, role navigation, feature pages, frontend API DTOs/hooks, forms, quotation/catalog/inventory/repair integration, responsive styling, or frontend tests.

Important rules: access tokens stay in memory; refresh uses the HttpOnly cookie; UI role visibility never replaces backend authorization; components do not call `fetch`; quotation amounts render only server responses and PART edits never send a client price.

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

Main files: `src/modules/users/user.route.ts`, `user.controller.ts`, `user.service.ts`, `user.repository.ts`, `user.model.ts`, `user.schema.ts`, `user.dto.ts`, and `src/common/services/image-storage.service.ts`.

Tables: `users`, `roles`, `auth_sessions`, `audit_logs`.

Dependencies: auth, customer profiles, and local image storage.

Read when: changing staff/user administration or safe user serialization.

Important rules: admin-only staff/role/status changes; safe self profile and avatar update; validate avatar MIME, raster signature, and size before random-name storage; revoke sessions on role/non-active status; protect self and final active admin; audit changes; never select hashes for response queries.

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

Important rules: at most one active assignment under a ticket row lock; close old then create new atomically; technician must be active, unlocked, and have the technician role; Manager lookup returns only active/unlocked technician identity fields; Phase 5 reassignment is limited to `ASSIGNED` tickets; assignment notifications and audit records share the transaction.

## Diagnoses Module

Purpose: findings, proposed repair, labor/risk, requested parts, submit/revision/approval.

Main files: `src/modules/diagnoses/diagnosis.route.ts`, `diagnosis.controller.ts`, `diagnosis.service.ts`, `diagnosis.repository.ts`, `diagnosis.model.ts`, `diagnosis.schema.ts`, `diagnosis.dto.ts` (implemented Phase 5).

Tables: `diagnoses`, `diagnosis_parts`.

Dependencies: assignments, repair tickets, parts, quotations.

Read when: diagnosis workflow or technician constraints change.

Important rules: active assigned author writes; one open diagnosis per ticket; active unique requested parts; submitted content is immutable until revision; manager revision/approval is audited; customer reads approved safe fields only; owning ticket transitions, history, and notifications are atomic.

## Quotations Module

Purpose: versioned price snapshots, internal approval, sending, expiry, and customer response.

Main files: `src/modules/quotations/quotation.route.ts`, `quotation.controller.ts`, `quotation.service.ts`, `quotation.repository.ts`, `quotation.model.ts`, `quotation.schema.ts`, `quotation.dto.ts` (implemented Phase 6).

Tables: `quotations`, `quotation_items`.

Dependencies: diagnoses, repair tickets, parts, customers, notifications.

Read when: quotation totals, versions, expiry, approval, or response changes.

Important rules: approved-diagnosis snapshots; server-calculated totals; catalog-owned PART prices; only sent/unexpired quotation may receive an owner response; supersede open versions; expiry and responses own atomic ticket history.

## Parts and Inventory Modules

Purpose: part catalog, balances, requests, fulfillment/return, and immutable movement history.

Main files: `src/modules/parts/part.route.ts`, `part.controller.ts`, `part.service.ts`, `part.repository.ts`, `part.model.ts`, `part.schema.ts`, `part.dto.ts`; and the corresponding `inventory.*` files under `src/modules/inventory/` (implemented Phase 7).

Tables: `parts`, `part_requests`, `part_request_items`, `inventory_transactions`.

Dependencies: repair tickets, assignments, diagnoses, quotations, users, notifications, audit logs, and future repair actions.

Read when: stock, part pricing, part request, fulfillment, return, or low-stock logic changes.

Important rules: inventory staff own catalog/movements/decisions; technicians require active assignment and see active catalog data without purchase prices; managers are read-only; lock balances in stable order; no negative stock; balance and immutable transaction row are atomic; partial fulfillment does not exceed outstanding request or stock; the final open request resumes repair atomically.

## Repair Actions Module

Purpose: repair logs, parts used, test results, and technical completion.

Main files: `src/modules/repair-actions/repair-action.route.ts`, `repair-action.controller.ts`, `repair-action.service.ts`, `repair-action.repository.ts`, `repair-action.model.ts`, `repair-action.schema.ts`, and `repair-action.dto.ts` (implemented Phase 8).

Tables: `repair_logs`, `repair_log_parts`, `test_results`.

Dependencies: assignments, fulfilled inventory requests, repair tickets, notifications, audit logs, and prior workflow sources for the timeline.

Read when: repair progress, part usage, testing, or completion changes.

Important rules: active assigned author writes only during repair; `finished_at` makes a log/parts immutable; attributed usage never decrements stock again or exceeds fulfillment; tests are append-only; newest case-insensitive named results gate completion; ticket/status history changes are atomic; customer reads are sanitized.

## Payments Module

Purpose: invoices, partial/full payments, balances, statuses, and refunds.

Main files: `src/modules/payments/payment.route.ts`, `payment.controller.ts`, `payment.service.ts`, `payment.repository.ts`, `payment.model.ts`, `payment.schema.ts`, and `payment.dto.ts` (implemented Phase 9).

Tables: `invoices`, `payments`.

Dependencies: accepted quotations, repair tickets/history, users, notifications, audit logs, and delivery readiness.

Read when: invoice calculation, payment, refund, or delivery readiness changes.

Important rules: one invoice per completed ticket; accepted-quotation totals are server-authoritative; locked cent-based balances prevent overpayment; completed payment fields are immutable; whole-payment refund requires active manager approval; financial/readiness/history/notification/audit changes are atomic.

## Deliveries Module

Purpose: device handover, recipient/proof, delivery timestamp, and closure.

Main files: `src/modules/deliveries/delivery.route.ts`, `delivery.controller.ts`, `delivery.service.ts`, `delivery.repository.ts`, `delivery.model.ts`, `delivery.schema.ts`, and `delivery.dto.ts` (implemented Phase 10).

Tables: `deliveries`, `repair_tickets`, `ticket_status_history`, `invoices`.

Dependencies: payments, repair tickets, customers, notifications.

Read when: handover or close-ticket policy changes.

Important rules: normally require full payment; manager exception is explicit/audited; one delivery per ticket; closure requires `DELIVERED` plus its delivery row and preserves status/audit history.

## Reviews Module

Purpose: post-delivery customer feedback.

Main files: `src/modules/reviews/review.route.ts`, `review.controller.ts`, `review.service.ts`, `review.repository.ts`, `review.model.ts`, `review.schema.ts`, and `review.dto.ts` (implemented Phase 10).

Tables: `reviews`, `repair_tickets`.

Dependencies: customers, repair tickets, reports.

Read when: rating, review ownership, or edit policy changes.

Important rules: one review per ticket; owner writes; ticket delivered/closed; ratings 1–5; owner edits expire after seven days; writes are audited.

## Notifications Module

Purpose: durable user notifications for assignments and ticket milestones.

Main files: `src/modules/notifications/notification.route.ts`, `notification.controller.ts`, `notification.service.ts`, `notification.repository.ts`, `notification.model.ts`, `notification.schema.ts`, and `notification.dto.ts` (read APIs implemented Phase 10; event writes remain in owning workflow repositories).

Tables: `notifications`.

Dependencies: users and all event-producing modules.

Read when: notification persistence/read status or event mapping changes.

Important rules: do not put secrets or sensitive internal notes in content; every list/count/read mutation is scoped by recipient user ID and read marking is idempotent.

## Reports Module

Purpose: read-only dashboard, revenue, performance, timing, parts usage, and low-stock aggregates.

Main files: `src/modules/reports/report.route.ts`, `report.controller.ts`, `report.service.ts`, `report.repository.ts`, `report.model.ts`, `report.schema.ts`, and `report.dto.ts` (implemented Phase 10).

Tables: read-only access across operational tables.

Dependencies: all source modules; no business module depends on reports for writes.

Read when: metrics definitions, filters, or report access changes.

Important rules: bounded UTC ranges; role-specific reports; revenue uses valid payments minus refunds; no customer PII in aggregates.
