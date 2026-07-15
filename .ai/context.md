# AI Context

This file is the short entry point requested by IDE/agent workflows. Detailed, canonical context remains split across the files below to avoid one oversized document.

## Current snapshot

- Project: Repair Ticket Management System using Node.js, Express, TypeScript, MySQL 8, `mysql2/promise`, and raw parameterized SQL.
- Architecture: Route -> Middleware -> Controller -> Service -> Repository -> MySQL.
- Completed: Phases 1–7, through the parts catalog, stock ledger, and part-request fulfillment.
- Verified: backend typecheck/build and 134 tests; frontend typecheck/lint/build and 19 tests; Phase 7 read, write, ledger, and locking queries against MySQL with rollback-safe verification.
- Frontend: standalone React app under `frontend/` integrates Phases 1–7, including role-safe parts/request workspaces and catalog selectors for diagnosis and quotation lines.
- Next: Phase 8 repair logs, fulfilled-part usage, testing, and technical completion.

## Phase 5 capabilities

- Manager-only atomic assignment/reassignment with one active technician, lock/status validation, notifications, and audit.
- Active assigned-author diagnosis create/edit/submit with validated requested parts.
- Manager revision/approval with durable notifications and approval audit.
- Atomic ticket transitions through `ASSIGNED`, `DIAGNOSING`, and `WAITING_FOR_QUOTATION` with immutable status history.
- Owner-only approved diagnosis reads with internal technical fields removed.

## Workflow boundary

Phases 4–7 expose intake, assignment, diagnosis, quotation/customer-decision, and part-request transitions through their owning services. The generic manager endpoint remains restricted to `RECEIVED <-> ON_HOLD`. Repair/testing, payment, delivery, closure, and timeline transitions remain owned by later phases.

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
