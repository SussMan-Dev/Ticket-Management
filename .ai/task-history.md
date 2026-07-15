# Task History

## 2026-07-15 — Phase 6 quotations and real frontend integration

Completed:

- Implemented the seven-file Quotations backend module with scoped list/detail, approved-diagnosis snapshot creation, DRAFT editing, submit/approve/send, expiry, and owner-only accept/reject flows.
- Made catalog PART descriptions/prices and every line/header total server-authoritative; initial items come from the latest approved diagnosis.
- Added ticket/current-quotation row locks, unique versions, supersession, atomic ticket history, durable notifications, and audit events.
- Integrated acceptance into `WAITING_FOR_PARTS` or `REPAIRING`, rejection into `CUSTOMER_REJECTED`, and materialized expiry back into `WAITING_FOR_QUOTATION`.
- Replaced the frontend mock gateway with typed REST calls and updated forms/detail/history to render server responses and never submit a PART price.
- Added 12 backend quotation tests, updated frontend quotation tests, and synchronized module/API/workflow/database/frontend/AI documentation.

Changed files:

- Added `src/modules/quotations/*`, `tests/quotation-service.test.ts`, and `tests/quotation-api.test.ts`.
- Mounted quotation routes and extended the ticket transition map for expiry.
- Updated quotation feature files under `frontend/src/features/quotations/` and their shared domain types/tests.
- Updated affected README, business/module documentation, and `.ai` maps/status/task files.

Database changes:

- No migration was required; existing quotation tables were used.
- Real MySQL SELECT/locking/version queries were verified. No workflow fixture was persisted because the configured database has no repair tickets.

API changes:

- Added `GET/POST /api/v1/repair-tickets/:ticketId/quotations`.
- Added `GET/PATCH /api/v1/quotations/:id` and submit/approve/send/accept/reject action endpoints.

Important decisions:

- Managers own every quotation write before sending; technicians are read-only and require an active assignment; customers see only sent versions and must own the ticket to respond.
- PART prices cannot be supplied by clients. Authorized manager-entered prices are limited to LABOR/OTHER draft lines.
- Tax and discount remain zero until an explicit configured business policy exists.
- Expiry is derived on reads and materialized atomically on response or replacement creation, preserving ticket history without requiring a scheduler.

Verification:

- Backend typecheck/build passed; all 112 backend tests passed.
- Frontend lint/build passed; all 16 frontend tests passed.
- Phase 6 repository read/locking queries passed against real MySQL.

Remaining:

- Phase 7 parts catalog, inventory ledger, and part-request fulfillment.
- Replace numeric Part ID inputs with the authorized parts catalog once Phase 7 endpoints exist.

## 2026-07-15 — MySQL pagination prepared-statement compatibility fix

Completed:

- Diagnosed the real `/api/v1/users` failure from the running backend stack trace at `UserRepository.list`.
- Replaced prepared-statement execution only for paginated list SELECTs in Users, Customers, Devices, and Repair Tickets with parameterized mysql2 text-protocol queries.
- Preserved placeholder escaping, repository-only SQL, bounded pagination, sort whitelists, API contracts, and authorization behavior.
- Verified all four list repositories against real MySQL, then passed TypeScript typecheck and all 100 backend tests.

Changed files:

- `src/modules/users/user.repository.ts`
- `src/modules/customers/customer.repository.ts`
- `src/modules/devices/device.repository.ts`
- `src/modules/repair-tickets/repair-ticket.repository.ts`
- `.ai/current-task.md`
- `.ai/task-history.md`

Database changes:

- None.

API changes:

- None; paginated list endpoints now execute successfully on the configured MySQL deployment.

Important decisions:

- The compatibility change is limited to SELECTs containing bound `LIMIT/OFFSET`; other prepared statements remain on `execute`.
- `query` continues to escape every placeholder through mysql2, so filter and pagination values are not interpolated manually.

## 2026-07-15 — Production frontend milestone (Phases 1–5 + Phase 6 adapter)

Completed:

- Created a standalone strict React/Vite application under `frontend/` with feature-based architecture, responsive design system, accessibility states, Vietnamese UI, role guards, and role-specific navigation.
- Implemented in-memory access-token handling, HttpOnly refresh-cookie transport, session restoration, single-flight refresh, one-time retry, typed envelopes, centralized query keys, and cache invalidation.
- Integrated implemented Auth, Users, Customers, Devices, Repair Tickets, Assignments, and Diagnoses APIs from actual backend schema/DTO/controller contracts.
- Added quotation history/detail/DRAFT/action UI through an isolated in-memory mock gateway because Phase 6 backend source files do not exist.
- Added 17 frontend tests covering auth transport, refresh concurrency, errors, route/role behavior, customer ownership UI, assignment/diagnosis rules, quotation states/expiry/supersession, invalidation, and 409/422 handling.
- Added frontend setup/security/role/API documentation and verified lint, strict typecheck, tests, dependency audit, and a route-split production build.

Changed files:

- Added the complete `frontend/` application, configuration, tests, lockfile, environment example, and README.
- Updated `.ai/project-context.md`, `.ai/code-map.md`, `.ai/current-task.md`, and `.ai/task-history.md`.

Database changes:

- None.

API changes:

- None. The frontend consumes existing Phase 1–5 APIs; quotation API integration remains intentionally absent.

Important decisions:

- Access tokens remain only in memory; refresh tokens remain browser-inaccessible HttpOnly cookies.
- Admin has account/configuration navigation only. Customer resource IDs are not used as authorization evidence.
- Phase 6 quotation fields and endpoints are not inferred. The mock gateway is visibly labeled and replaceable after actual backend DTOs exist.
- Missing manager technician lookup and Phase 7 parts catalog APIs are documented rather than fabricated.

Remaining:

- Implement backend Phase 6 and bind the quotation gateway to its actual server-calculated contract.
- Add manager-authorized technician lookup and Phase 7 part catalog integrations when those endpoints are defined.

## 2026-07-15 — Phase 5 assignments and diagnoses

Completed:

- Implemented manager-only atomic ticket assignment/reassignment with one active assignment, active/unlocked technician validation, immutable assignment history, technician notifications, and assignment audit events.
- Implemented diagnosis list/create/edit/submit/revision/approval with active-assigned-author checks, one open diagnosis, active requested parts, immutable submitted content, and manager review.
- Integrated `RECEIVED → ASSIGNED → DIAGNOSING → WAITING_FOR_QUOTATION` and diagnosis revision transitions with ticket row locks and immutable status history.
- Added approved-only customer-safe diagnosis serialization that excludes root cause, internal risk/part notes, and staff identity.
- Added Phase 5 service/API tests and synchronized API, workflow, authorization, database, module, README, and AI-context documentation.

Changed files:

- Added standard seven-file modules under `src/modules/ticket-assignments/` and `src/modules/diagnoses/`.
- Updated API route composition, added four Phase 5 test files, and updated affected documentation/maps/status files.

Database changes:

- No schema migration was required.
- Verified real assignment, reassignment, status-history, diagnosis-part lifecycle, notification, and audit repository operations inside one rolled-back development MySQL transaction.

API changes:

- Added `POST /api/v1/repair-tickets/:id/assign` and `/reassign`.
- Added `GET/POST /api/v1/repair-tickets/:ticketId/diagnoses`.
- Added `PATCH /api/v1/diagnoses/:id` plus `/submit`, `/request-revision`, and `/approve` actions.

Important decisions:

- Assignment and diagnosis transitions remain unavailable through the generic status endpoint and run only in their owning transactional services.
- Phase 5 reassignment is limited to `ASSIGNED` tickets so a diagnosis cannot be stranded after its active author changes.
- Diagnosis submission moves the ticket to `WAITING_FOR_QUOTATION`; approval finalizes the diagnosis without manufacturing a same-status ticket history row.
- Customer diagnosis reads are approved-only and deliberately omit internal technical/staff fields.

Verification:

- TypeScript typecheck and production build passed.
- All 100 tests passed, including 20 new Phase 5 service/API tests.
- SQL location review found application SQL only in repository files.
- Real repository transaction and row-lock flow passed and rolled back without retaining test records.

Remaining:

- Phase 6 versioned quotations, price snapshots, manager approval/sending, expiry, and owner-only customer response.

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
