# Repair Ticket Management System

Backend REST API for the lifecycle of a repair request: device intake, diagnosis, quotation, parts usage, repair, testing, payment, delivery, and customer review.

The repository currently contains completed Phases 1–7: foundation, authentication/users, customers/devices, repair-ticket intake, assignment/diagnosis, versioned quotation/customer-response, and parts/inventory workflows.

## Technology

- Node.js 20+
- Express 5 and TypeScript
- MySQL 8 with `mysql2/promise`
- Raw, parameterized SQL only; no ORM or query builder
- Zod validation, Helmet, CORS, JWT/bcrypt dependencies for Phase 2
- Vitest and Supertest

## Architecture

```text
Route → Middleware → Controller → Service → Repository → MySQL
```

Business logic belongs in services. Only repositories may contain application SQL. Multi-table state changes use `withTransaction`.

## Local setup

1. Copy `.env.example` to `.env` and set database credentials.
2. Create an empty MySQL 8 database named by `DB_NAME` using `utf8mb4`.
3. Apply `src/database/schema.sql` to that database.
4. Apply the ordered SQL files under `src/database/seeds/` (`001_roles.sql`, then `002_device_catalogs.sql`).
5. Install dependencies with `npm install`.
6. Run `npm run dev`.

For an existing Phase 1 database, apply `src/database/migrations/002_add_login_security_fields.sql` instead of reapplying the bootstrap schema, then apply `src/database/seeds/002_device_catalogs.sql`. To create the first administrator, set `ADMIN_FULL_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` locally, then run `npm run seed:admin`.

The server verifies its MySQL connection before listening. Timestamps are handled as UTC.

## Commands

```text
npm run dev        Start the development watcher
npm run typecheck  Check TypeScript without emitting files
npm test           Run the test suite once
npm run build      Compile to dist/
npm start          Run the compiled server
npm run seed:admin Create the initial admin idempotently from local env
npm run seed:catalogs Seed active device category/brand defaults idempotently
```

## Implemented endpoints

- `GET /api/v1/health` for process liveness.
- `/api/v1/auth/*` for registration, login, refresh rotation, logout, logout-all, and current user.
- `/api/v1/users/*` for administrator user management and safe self profile updates.
- `/api/v1/customers/*` for owned customer profiles and receptionist/manager intake lookup.
- `/api/v1/devices/*` for owned/staff-scoped device CRUD plus active category/brand catalogs.
- `/api/v1/repair-tickets/*` for owned/assigned ticket retrieval, intake CRUD, receive/hold/cancel history, attachment metadata, manager assignment/reassignment, and ticket-scoped diagnoses.
- `/api/v1/diagnoses/*` for active-assignee editing/submission and manager revision/approval.
- `/api/v1/quotations/*` for draft editing, manager approval/sending, expiry, and owner response; ticket-scoped quotation list/create lives under `/api/v1/repair-tickets/:ticketId/quotations`.
- `/api/v1/parts/*` for role-safe catalog reads, inventory-staff maintenance, stock-in/adjustment, and immutable movement history.
- `/api/v1/part-requests/*` for inventory decisions and partial fulfillment; assigned-technician creation lives under `/api/v1/repair-tickets/:ticketId/part-requests`.

Access tokens use Bearer authentication. Refresh tokens are scoped HttpOnly cookies and are never returned in JSON.

## Documentation

Start with `AGENTS.md`, `.ai/project-context.md`, and `docs/architecture.md`. Module contracts are under `docs/modules/`; future implementation status is tracked in `.ai/module-status.md`.
