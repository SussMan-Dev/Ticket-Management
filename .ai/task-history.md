# Task History

## 2026-07-14 — Phase 4 repair tickets

Completed:

- Implemented repair-ticket list/detail/create/update with customer ownership, intake staff access, and active technician assignment visibility.
- Implemented atomic ticket creation with customer-owned active device validation, generated ticket codes, and initial status history.
- Implemented receptionist receive, manager hold/resume, customer/manager cancellation, row-locked transition validation, and immutable status-history reads.
- Implemented validated HTTP(S) attachment metadata reads/creates with role-specific attachment types and terminal-state protection.
- Implemented `GET /customers/:id/tickets`, added Phase 4 service/API tests, and updated API/workflow/authorization/module/project documentation.
- Added `.ai/context.md` as the IDE/agent entry point and audited every `.ai` map/status file against the completed Phase 4 state.

Changed files:

- Repair Tickets module under `src/modules/repair-tickets/`.
- Customer controller/route integration, API route composition, Phase 4 tests, README, module/workflow/business-rule docs, and `.ai` maps/status files.

Database changes:

- No schema migration was required.
- Verified real customer, device, ticket, status-history, and attachment repository operations inside one rolled-back development MySQL transaction.

API changes:

- Added Phase 4 `/api/v1/repair-tickets*` intake, CRUD, receive, hold/resume, cancellation, history, and attachment endpoints.
- Added the previously deferred `GET /api/v1/customers/:id/tickets` endpoint.
- Kept assignment/reassignment and aggregate timeline endpoints deferred to their owning phases.

Important decisions:

- Customer ownership is derived from the authenticated identity; staff must explicitly select a customer whose active device is owned by that customer.
- Customers cannot set priority, SLA dates, received state, or cross-owner data.
- The generic status endpoint exposes only manager hold/resume in Phase 4; later workflow transitions cannot be bypassed.
- Attachment URLs are metadata-only HTTP(S) references, with role/type authorization and no destructive delete endpoint.

Verification:

- TypeScript typecheck and production build passed.
- All 80 tests passed, including 17 new Phase 4 tests.
- SQL location review found application SQL only in the Repair Tickets repository.
- Real repository transaction and row-lock flow passed and rolled back without retaining test records.

Remaining:

- Phase 5 ticket assignments/reassignments and diagnosis workflow.

## 2026-07-14 — Phase 3 customers and devices

Completed:

- Implemented customer self profile access/update plus receptionist/manager customer search, detail, creation, and update with minimal list PII and staff-only notes.
- Implemented owned/staff-scoped device list, detail, create, update, and soft-delete plus active category/brand catalog endpoints.
- Added bounded validation, pagination/search/sort whitelists, service ownership checks, active customer/catalog validation, transactions, row locks, and customer creation audit records.
- Added an idempotent device catalog SQL seed and `npm run seed:catalogs`; applied it to the development database.
- Added Phase 3 service/API tests and updated project, API, database, business-rule, module, and setup documentation.

Changed files:

- Customers and Devices modules under `src/modules/`.
- API route composition, catalog seed SQL/runner, package scripts, Phase 3 tests, README, module docs, and `.ai` maps/status files.

Database changes:

- No schema migration was required.
- Seeded default active device categories and brands idempotently in the development database.
- Verified real customer/profile/device repository operations inside a rolled-back transaction.

API changes:

- Added implemented customer endpoints from Phase 3 except the Phase 4 ticket collection.
- Added device CRUD plus `GET /api/v1/devices/categories` and `GET /api/v1/devices/brands`.

Important decisions:

- Customer ownership is derived only from the authenticated user; serial/IMEI and request-supplied customer IDs never grant access.
- Customer notes are staff-only and omitted from customer/list responses.
- Device writes validate active customer/category/brand references and use transactions; deletion is always soft.

Verification:

- TypeScript typecheck and production build passed.
- All 63 tests passed, including 21 new Phase 3 tests.
- SQL location review found application SQL only in repository files.
- Real repository transaction check passed and rolled back without retaining test rows.

Remaining:

- Phase 4 repair tickets, including the deferred customer ticket collection endpoint.

## 2026-07-14 — Phase 2 authentication and users

Completed:

- Implemented customer registration, bcrypt login, failed-attempt temporary lock, access JWTs, database-backed session authentication, HttpOnly refresh rotation/replay revocation, logout, logout-all, and current user.
- Implemented admin user list/detail/staff creation/profile update/status/role APIs with last-admin protection, audit logs, and session revocation.
- Added login rate limiting, JWT/password/refresh utilities, authentication/authorization middleware, cookie handling, and idempotent admin seed command.
- Added migration 002, updated the bootstrap schema, applied migration to development, seeded seven roles, and verified real register/login/refresh repository flow inside a rolled-back transaction.
- Added Phase 2 unit/API tests and updated architecture/API/database/module documentation.

Changed files:

- Auth and Users modules under `src/modules/`.
- Security middleware/utilities and shared audit repository.
- Environment, JWT, app, routes, package configuration, schema/migration, seed script, tests, docs, and `.ai` maps.

Database changes:

- Applied `002_add_login_security_fields.sql` to add `failed_login_attempts`, `locked_until`, and its index.
- Applied the idempotent seven-role seed to the development database.

API changes:

- Added all `/api/v1/auth/*` and `/api/v1/users/*` endpoints defined in the Phase 2 API map.

Important decisions:

- Refresh tokens are SHA-256 hashed, stored only in HttpOnly cookies, rotated with a row lock, and include a unique JWT ID.
- Protected access verifies both JWT claims and current database session/user/role state.
- Role/status changes revoke sessions immediately; the final active administrator is protected.

Verification:

- Migration and role seed verified on development MySQL.
- Real repository flow verified with transaction rollback.
- TypeScript type-check and production build passed.
- 42 tests passed; dependency audit reported no vulnerabilities after cookie-parser installation.

Remaining:

- Configure `ADMIN_*` locally and run `npm run seed:admin` when an initial administrator is desired.
- Phase 3 Customers and Devices.

## 2026-07-14 — Local environment configuration

Completed:

- Created the ignored local `.env` from the developer's current database settings.
- Replaced credentials in `.env.example` with safe placeholders and documented secret requirements.
- Corrected local JWT values so access and refresh secrets are distinct and pass the 32-character validation rule.
- Verified the local MySQL connection and reran all seven foundation tests successfully.

Changed files:

- `.env` (local and ignored)
- `.env.example`
- `.ai/current-task.md`
- `.ai/task-history.md`

Database changes:

- None.

API changes:

- None.

Important decisions:

- Local database values stay only in `.env`; reusable examples never contain working credentials.

Remaining:

- Apply the bootstrap schema and role seed if the configured database is still empty.

## 2026-07-14 — Phase 1 project foundation

Completed:

- Initialized the Node.js, Express, TypeScript, Zod, and MySQL foundation.
- Added environment validation, secure HTTP defaults, database lifecycle, common response/errors, validation, pagination, structured redacted logging, and transaction utility.
- Added the complete 28-table MySQL bootstrap schema with constraints/indexes and an idempotent seven-role seed.
- Added health/not-found API tests and full architecture, database, workflow, authorization, module, and AI-context documentation.
- Verified TypeScript type-check and production build; all seven foundation tests passed and npm audit reported no vulnerabilities.

Changed files:

- Project configuration and runtime files under the repository root and `src/`.
- `src/database/schema.sql` and `src/database/seeds/001_roles.sql`.
- Documentation under `docs/` and `.ai/`.
- Foundation tests under `tests/`.

Database changes:

- Initial bootstrap schema; no incremental migration was applied.

API changes:

- Added public `GET /api/v1/health`.
- Added standard success/error envelopes and unknown-route behavior.

Important decisions:

- The full relational schema is reviewed early while business APIs remain phased.
- Server startup requires MySQL, but importing the Express app for tests does not.
- JWT configuration is present but authentication remains intentionally unimplemented until Phase 2.

Remaining:

- Phase 2 authentication and users, followed by Phases 3–10.
- Run the schema against a configured MySQL 8 instance as an integration check.
