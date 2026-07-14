# AI Context

This file is the short entry point requested by IDE/agent workflows. Detailed, canonical context remains split across the files below to avoid one oversized document.

## Current snapshot

- Project: Repair Ticket Management System using Node.js, Express, TypeScript, MySQL 8, `mysql2/promise`, and raw parameterized SQL.
- Architecture: Route -> Middleware -> Controller -> Service -> Repository -> MySQL.
- Completed: Phase 1 Foundation, Phase 2 Auth/Users, Phase 3 Customers/Devices, and Phase 4 Repair Tickets.
- Verified: TypeScript typecheck, production build, 80 tests, repository SQL location, and rolled-back Phase 4 MySQL integration flow.
- Next: Phase 5 ticket assignment/reassignment and diagnosis workflow.

## Phase 4 capabilities

- Customer-owned and staff/active-assignment scoped ticket retrieval.
- Ticket creation/update, receptionist receive, manager hold/resume, and customer/manager cancellation.
- Atomic status transitions with immutable `ticket_status_history`.
- Validated HTTP(S) attachment metadata with role/type authorization.
- `GET /customers/:id/tickets` customer collection.

## Workflow boundary

Phase 4 exposes only `NEW -> RECEIVED`, configured cancellation, and manager `RECEIVED <-> ON_HOLD`. Assignment, diagnosis, quotation, inventory, repair/testing, payment, delivery, closure, and timeline transitions remain owned by later phases.

## Canonical files

1. `AGENTS.md` — repository rules and completion checklist.
2. `.ai/project-context.md` — product, architecture, implementation status, and next work.
3. `.ai/code-map.md` — module ownership and source locations.
4. `.ai/current-task.md` — most recently completed work and next target.
5. `.ai/database-map.md` — table ownership, constraints, and persistence rules.
6. `.ai/api-map.md` — endpoint contracts, roles, transactions, and phase status.
7. `docs/business-rules.md` and affected module documentation — canonical business behavior.
8. `.ai/module-status.md` — module implementation/test/documentation matrix.
9. `.ai/task-history.md` — chronological completed work; older “Remaining” sections are historical snapshots and must not be treated as current state.

## Reading rule

Start with this file, then read only the canonical files and module documentation needed for the current task. Do not scan the entire repository unless those sources are insufficient.
