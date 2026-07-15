# Database Map

The canonical definitions are in `src/database/schema.sql`. Read that file before changing a column, constraint, index, or foreign-key order.

## roles

- Purpose: seeded authorization roles.
- Primary key: `id`.
- Foreign keys: none.
- Important columns: unique `code`, `name`, `description`.
- Important indexes: unique `code`.
- Owned by: Users/Auth.
- Read full schema when: changing role codes or user foreign keys.

## users

- Purpose: customer and staff accounts.
- Primary key: `id`.
- Foreign keys: `role_id → roles.id`.
- Important columns: `email`, `phone`, `password_hash`, `status`, `failed_login_attempts`, `locked_until`, `deleted_at`.
- Important indexes: unique email/phone; `(role_id, status)`, `locked_until`, `deleted_at`.
- Owned by: Users.
- Read full schema when: authentication, profile, status, role, or soft-delete logic changes.

## auth_sessions

- Purpose: refresh-token sessions per device/login.
- Primary key: UUID `id`.
- Foreign keys: `user_id → users.id`.
- Important columns: SHA-256 `refresh_token_hash`, `expires_at`, `revoked_at`, IP/user agent.
- Important indexes: user, expiry, and `(user_id, revoked_at, expires_at)`.
- Owned by: Auth.
- Read full schema when: refresh rotation, logout, cleanup, or session limits change.

## customer_profiles

- Purpose: one-to-one customer-specific profile extension.
- Primary key: `id`.
- Foreign keys: unique `user_id → users.id`.
- Important columns: `address`, staff `notes`.
- Important indexes: unique `user_id`.
- Owned by: Customers.
- Read full schema when: registration/profile fields change.

## device_categories

- Purpose: managed device category catalog.
- Primary key: `id`.
- Foreign keys: none.
- Important columns: unique `name`, `description`, `is_active`.
- Important indexes: unique `name`.
- Owned by: Devices/Admin catalog.
- Bootstrap data: idempotent defaults in `src/database/seeds/002_device_catalogs.sql`.
- Read full schema when: category administration changes.

## device_brands

- Purpose: managed device brand catalog.
- Primary key: `id`.
- Foreign keys: none.
- Important columns: unique `name`, `is_active`.
- Important indexes: unique `name`.
- Owned by: Devices/Admin catalog.
- Bootstrap data: idempotent defaults in `src/database/seeds/002_device_catalogs.sql`.
- Read full schema when: brand administration changes.

## devices

- Purpose: customer-owned equipment.
- Primary key: `id`.
- Foreign keys: `customer_id → users.id`, `category_id → device_categories.id`, `brand_id → device_brands.id`.
- Important columns: model, serial, IMEI, description, `deleted_at`.
- Important indexes: customer, serial, IMEI, deleted timestamp.
- Owned by: Devices.
- Read full schema when: ownership, identification, soft deletion, or ticket creation changes.

## repair_tickets

- Purpose: main repair request and current workflow state.
- Primary key: `id`.
- Foreign keys: customer/device/creator to `users` or `devices`.
- Important columns: unique `ticket_code`, `status`, `priority`, expectations and milestone timestamps.
- Important indexes: customer, device, status, created time, `(status, priority)`, deleted timestamp.
- Owned by: Repair Tickets.
- Implementation: Phase 4 CRUD/intake is complete; ticket codes use `RT-YYYY-NNNNNN`, customer/device identity is immutable after creation, and later workflow milestones remain phase-owned.
- Read full schema when: ticket CRUD, filters, transitions, SLA, or timeline changes.

## ticket_attachments

- Purpose: URL metadata for ticket images/proof.
- Primary key: `id`.
- Foreign keys: `ticket_id → repair_tickets.id`, `uploaded_by → users.id`.
- Important columns: `attachment_type`, `file_url`, filename and MIME type.
- Important indexes: ticket.
- Owned by: Repair Tickets.
- Implementation: Phase 4 stores validated HTTP(S) metadata only; role/type checks happen in the service and no delete endpoint is exposed.
- Read full schema when: uploads, proof, or attachment visibility changes.

## ticket_assignments

- Purpose: append-only technician assignment history.
- Primary key: `id`.
- Foreign keys: ticket, technician, assigner.
- Important columns: assigned/unassigned timestamps, `is_active`, note.
- Important indexes: `(ticket_id, is_active)`, `(technician_id, is_active)`.
- Owned by: Ticket Assignments.
- Implementation: Phase 5 serializes writes with a ticket row lock, validates active/unlocked technicians, closes the prior row before reassignment, and writes notifications/audit atomically. Reassignment is currently limited to `ASSIGNED` tickets.
- Read full schema when: assignment concurrency, workload, or reassignment changes.

## ticket_status_history

- Purpose: append-only audit trail of ticket transitions.
- Primary key: `id`.
- Foreign keys: ticket and actor user.
- Important columns: `from_status`, `to_status`, `reason`, `created_at`.
- Important indexes: ticket and created time.
- Owned by: Repair Tickets.
- Implementation: Phase 4 appends the initial state and every allowed transition in the same transaction as the ticket update; rows are immutable.
- Read full schema when: status/timeline/audit behavior changes.

## diagnoses

- Purpose: technician diagnosis and approval state.
- Primary key: `id`.
- Foreign keys: ticket, technician, approving user.
- Important columns: issue/cause/solution, labor, hours, data-loss risk, status and approval timestamps.
- Important indexes: ticket; `(technician_id, status)`.
- Owned by: Diagnoses.
- Implementation: Phase 5 supports one open draft/submission/revision per ticket, active-assignee authorship, manager approval, and customer-safe approved reads with owning ticket transitions.
- Read full schema when: diagnosis content, approval, pricing, or risk changes.

## parts

- Purpose: part catalog and current stock balance.
- Primary key: `id`.
- Foreign keys: none.
- Important columns: unique SKU, prices, `quantity_on_hand`, `minimum_stock`, `is_active`.
- Important indexes: name; active/stock threshold.
- Owned by: Parts/Inventory.
- Read full schema when: pricing, stock, low-stock, or catalog changes.

## diagnosis_parts

- Purpose: positive part quantities proposed by a diagnosis.
- Primary key: `id`.
- Foreign keys: `diagnosis_id → diagnoses.id`, `part_id → parts.id`.
- Important columns: `quantity`, note.
- Important indexes: unique `(diagnosis_id, part_id)`.
- Owned by: Diagnoses.
- Implementation: Phase 5 replaces requested parts only while a diagnosis is editable, validates active part references, and keeps the replacement in the diagnosis transaction.
- Read full schema when: requested-part diagnosis logic changes.

## quotations

- Purpose: versioned quotation header and approval/customer response state.
- Primary key: `id`.
- Foreign keys: ticket, diagnosis, creator, approver.
- Important columns: version, status, amount components, expiry, approval/send/response timestamps.
- Important indexes: unique `(ticket_id, version)`, `(ticket_id, status)`.
- Owned by: Quotations.
- Read full schema when: version, totals, approval, expiry, or response changes.

## quotation_items

- Purpose: immutable description/price snapshot lines.
- Primary key: `id`.
- Foreign keys: quotation and optional part.
- Important columns: type, description, positive quantity, unit price, line total.
- Important indexes: quotation.
- Owned by: Quotations.
- Read full schema when: totals, item types, or price snapshot changes.

## part_requests

- Purpose: ticket-level request and fulfillment workflow header.
- Primary key: `id`.
- Foreign keys: ticket, requester, approver.
- Important columns: status, note, approval timestamp.
- Important indexes: status/created time and ticket.
- Owned by: Inventory.
- Read full schema when: request approval/fulfillment workflow changes.

## part_request_items

- Purpose: requested and fulfilled quantities per part.
- Primary key: `id`.
- Foreign keys: part request and part.
- Important columns: positive `requested_quantity`, bounded `fulfilled_quantity`.
- Important indexes: unique `(part_request_id, part_id)`.
- Owned by: Inventory.
- Read full schema when: partial fulfillment changes.

## inventory_transactions

- Purpose: immutable stock movement ledger.
- Primary key: `id`.
- Foreign keys: part, optional ticket, actor user.
- Important columns: movement type, positive quantity, before/after balances, generic reference, note.
- Important indexes: part, ticket, created time.
- Owned by: Inventory.
- Read full schema when: any stock movement, return, audit, or reconciliation changes.

## repair_logs

- Purpose: append-oriented technician work log.
- Primary key: `id`.
- Foreign keys: ticket and technician.
- Important columns: action, result, start/finish timestamps.
- Important indexes: ticket.
- Owned by: Repair Actions.
- Read full schema when: work logging or progress timing changes.

## repair_log_parts

- Purpose: positive part usage attributed to a repair log.
- Primary key: `id`.
- Foreign keys: repair log and part.
- Important columns: quantity.
- Important indexes: unique `(repair_log_id, part_id)`.
- Owned by: Repair Actions/Inventory.
- Read full schema when: consumed-part attribution changes.

## test_results

- Purpose: device test pass/fail evidence.
- Primary key: `id`.
- Foreign keys: ticket and testing user.
- Important columns: test name, result, note, tested time.
- Important indexes: ticket.
- Owned by: Repair Actions.
- Read full schema when: test requirements or completion changes.

## invoices

- Purpose: one calculated bill per repair ticket.
- Primary key: `id`.
- Foreign keys: unique ticket and creator user.
- Important columns: unique invoice code, amount components, paid amount, payment status.
- Important indexes: unique ticket/code; payment status.
- Owned by: Payments.
- Read full schema when: totals, balance, status, or invoice creation changes.

## payments

- Purpose: immutable payment records and refund state.
- Primary key: `id`.
- Foreign keys: invoice and cashier user.
- Important columns: unique payment code, positive amount, method, status, external reference, paid time.
- Important indexes: invoice and paid time.
- Owned by: Payments.
- Read full schema when: payment, refund, reconciliation, or method changes.

## deliveries

- Purpose: one device handover record per ticket.
- Primary key: `id`.
- Foreign keys: unique ticket and delivering user.
- Important columns: recipient name/phone, proof URL, delivery time.
- Important indexes: unique ticket.
- Owned by: Deliveries.
- Read full schema when: delivery, proof, or closure changes.

## reviews

- Purpose: one customer service review per ticket.
- Primary key: `id`.
- Foreign keys: unique ticket and customer user.
- Important columns: overall/technician/service ratings (1–5), comment.
- Important indexes: unique ticket; customer.
- Owned by: Reviews.
- Read full schema when: feedback, ratings, or ownership policy changes.

## notifications

- Purpose: durable per-user notifications.
- Primary key: `id`.
- Foreign keys: user.
- Important columns: type/title/content, generic reference, read state/timestamp.
- Important indexes: `(user_id, is_read)`, created time.
- Owned by: Notifications.
- Read full schema when: notification delivery/read behavior changes.

## audit_logs

- Purpose: immutable evidence of sensitive actions.
- Primary key: `id`.
- Foreign keys: optional actor user.
- Important columns: action/entity, optional old/new JSON, IP/user agent, timestamp.
- Important indexes: `(entity_type, entity_id)`, user, created time.
- Owned by: Cross-cutting audit infrastructure.
- Read full schema when: audit payload, retention, or compliance reporting changes.
