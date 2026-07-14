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

Phases 1 through 4 are complete. Foundation includes configuration, MySQL lifecycle, common errors/responses, validation, logging, transactions, schema/seeds, and tests. Auth and Users provide secure account/session lifecycle and administration. Customers and Devices provide owned/staff intake data. Repair Tickets now provides owner/assignment-scoped retrieval, intake CRUD, receive/hold/cancel transitions, immutable status history, and validated attachment metadata.

## Next work

Phase 5: ticket assignment/reassignment and diagnosis workflow. It must reuse Repair Tickets row locks/history transitions and preserve the Phase 4 visibility boundaries.

## AI navigation

`.ai/context.md` is the short IDE/agent entry point. This file remains the canonical detailed project snapshot; use the code, database, API, module-status, current-task, and task-history maps only as needed for the active module.
