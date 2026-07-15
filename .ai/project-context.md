# Project Context

## Goal

Repair Ticket Management System manages customer/device intake, diagnosis, quotation approval, parts inventory, repair/testing, invoice/payment, delivery, review, and operational reporting.

## Technology and architecture

Node.js 20+, Express 5, TypeScript, MySQL 8, `mysql2/promise`, Zod, JWT, bcrypt, dotenv, raw parameterized SQL, and REST. Request flow is Route → Middleware → Controller → Service → Repository → MySQL. Services own business rules and transactions; SQL exists only in repositories (except bootstrap/migration/seed SQL files).

## Roles

`CUSTOMER`, `RECEPTIONIST`, `TECHNICIAN`, `MANAGER`, `ADMIN`, `INVENTORY_STAFF`, and `CASHIER`.

## Ticket lifecycle

Intake (`NEW`/`RECEIVED`) → assignment → diagnosis → quotation/customer decision → parts/repair → testing → completion/payment → delivery/closure. Every transition is validated and recorded atomically in status history.

## Critical constraints

- Check both role and resource ownership/assignment.
- Preserve ticket status, assignment, inventory, payment, and audit history.
- Never allow negative stock or payment beyond invoice balance.
- Snapshot quotation item prices and version quotations.
- Use transactions for multi-record workflows and refresh-token rotation.
- Never expose password or refresh-token hashes.

## Implementation status

Phases 1 through 5 are complete. Foundation includes configuration, MySQL lifecycle, common errors/responses, validation, logging, transactions, schema/seeds, and tests. Auth and Users provide secure account/session lifecycle and administration. Customers and Devices provide owned/staff intake data. Repair Tickets provides owner/assignment-scoped retrieval, intake CRUD, receive/hold/cancel transitions, immutable status history, and validated attachment metadata. Assignments now provides manager-only atomic assignment/reassignment with active-technician validation, notification, and audit history. Diagnoses provides active-assignee drafts/parts, submission/revision/approval, customer-safe approved reads, and owning ticket transitions.

A standalone React frontend now exists under `frontend/`. It integrates implemented Phase 1–5 contracts with memory-only access tokens, refresh-cookie rotation, role-aware routes, responsive Vietnamese UI, typed Query hooks, validated forms, and automated tests. Phase 6 quotation screens use a visibly labeled in-memory gateway until actual backend schema/DTO files exist.

## Next work

Phase 6: versioned quotations, server-calculated price snapshots, manager approval/sending, expiry, and owner-only customer response. It must consume an approved diagnosis and preserve the Phase 5 ticket/visibility boundaries.

## AI navigation

`.ai/context.md` is the short IDE/agent entry point. This file remains the canonical detailed project snapshot; use the code, database, API, module-status, current-task, and task-history maps only as needed for the active module.
