# Database

## Platform and conventions

The schema targets MySQL 8.0 with InnoDB and `utf8mb4_unicode_ci`. Application timestamps use UTC. Primary keys are unsigned `BIGINT` except UUID session IDs. Money uses `DECIMAL`; floating point is not used for financial values.

Foreign keys preserve referential integrity. Soft deletion is used for users, devices, and repair tickets. Financial records, status history, assignment history, inventory transactions, and audit logs are append-only from the business application's perspective.

## Table groups

- Identity: `roles`, `users`, `auth_sessions`, `customer_profiles`.
- Device catalog: `device_categories`, `device_brands`, `devices`.
- Ticket lifecycle: `repair_tickets`, `ticket_attachments`, `ticket_assignments`, `ticket_status_history`.
- Diagnosis and quotation: `diagnoses`, `diagnosis_parts`, `quotations`, `quotation_items`.
- Inventory: `parts`, `part_requests`, `part_request_items`, `inventory_transactions`.
- Repair and testing: `repair_logs`, `repair_log_parts`, `test_results`.
- Billing and handover: `invoices`, `payments`, `deliveries`.
- Engagement and governance: `reviews`, `notifications`, `audit_logs`.

## Bootstrap

Apply `src/database/schema.sql` to an empty database, then run `src/database/seeds/001_roles.sql`. The role seed is idempotent. The schema includes checks for non-negative stock, positive item quantities, valid rating ranges, valid log time ranges, and non-negative financial values.

## Query policy

Application SQL belongs only in repository files. Use `execute` with placeholders for values. Never use `SELECT *`. List queries require bounded pagination, filter parameters, and a server-side sort whitelist. Identifiers cannot be accepted directly from a client.

## Transaction policy

Transactions are mandatory for status plus history, assignment changes, quotations plus items, inventory movement plus balances, invoice/payment updates, delivery, refunds, and refresh-token rotation. Lock mutable balance rows with `SELECT ... FOR UPDATE` inside the owning repository before calculating a new quantity.

## Migrations

The bootstrap schema represents the current canonical schema. Later changes use immutable, ordered scripts in `src/database/migrations/`; deployment tooling must record which migrations have run.

## Phase 2 migration

`002_add_login_security_fields.sql` adds `users.failed_login_attempts`, `users.locked_until`, and an index on the lock timestamp. The same fields are present in the canonical bootstrap schema. The development database was migrated during Phase 2; each other environment must apply the migration exactly once. Administrative `status = LOCKED` remains separate from temporary `locked_until`.

## Phase 5 persistence

Assignments and diagnoses use the existing `ticket_assignments`, `diagnoses`, `diagnosis_parts`, `repair_tickets`, `ticket_status_history`, `notifications`, and `audit_logs` definitions. No Phase 5 migration is required. Ticket row locks serialize assignment/diagnosis workflows; draft diagnosis-part replacement is transactional, while submitted/approved diagnosis content and assignment history are preserved.
