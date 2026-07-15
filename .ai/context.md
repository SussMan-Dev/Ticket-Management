# AI Context

This file is the short entry point requested by IDE/agent workflows. Detailed, canonical context remains split across the files below to avoid one oversized document.

## Current snapshot

- Project: Repair Ticket Management System using Node.js, Express, TypeScript, MySQL 8, `mysql2/promise`, and raw parameterized SQL.
- Architecture: Route -> Middleware -> Controller -> Service -> Repository -> MySQL.
- Completed: Phase 1 Foundation, Phase 2 Auth/Users, Phase 3 Customers/Devices, Phase 4 Repair Tickets, and Phase 5 Assignments/Diagnoses.
- Verified: TypeScript typecheck, production build, 100 tests, repository SQL location, and rolled-back Phase 5 MySQL repository flow.
- Frontend: standalone React app under `frontend/` integrates Phases 1–5; Phase 6 screens use an isolated mock gateway because backend quotation source is absent.
- Next: Phase 6 versioned quotation workflow and customer response, followed by binding the frontend quotation gateway to its actual DTOs.

## Phase 5 capabilities

- Manager-only atomic assignment/reassignment with one active technician, lock/status validation, notifications, and audit.
- Active assigned-author diagnosis create/edit/submit with validated requested parts.
- Manager revision/approval with durable notifications and approval audit.
- Atomic ticket transitions through `ASSIGNED`, `DIAGNOSING`, and `WAITING_FOR_QUOTATION` with immutable status history.
- Owner-only approved diagnosis reads with internal technical fields removed.

## Workflow boundary

Phases 4 and 5 expose intake, assignment, and diagnosis transitions through their owning services. The generic manager endpoint remains restricted to `RECEIVED <-> ON_HOLD`. Quotation, inventory, repair/testing, payment, delivery, closure, and timeline transitions remain owned by later phases.

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
