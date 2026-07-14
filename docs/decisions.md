# Architecture decisions

## ADR-001 — Raw SQL with repositories

Use `mysql2/promise` and parameterized SQL in repository files. An ORM or query builder is prohibited. This makes query shape and transaction locking explicit, at the cost of manual row/DTO mapping.

## ADR-002 — Service-owned transactions

The service that owns a business use case opens the transaction and passes its connection to repositories. This keeps atomicity aligned with business rules and prevents repositories from committing partial workflows.

## ADR-003 — Validate environment at import time

Current Phase 1 settings are parsed once by Zod. JWT secrets remain optional until authentication is enabled, but `getJwtConfiguration` refuses missing, short, or identical secrets before Phase 2 token operations can start.

## ADR-004 — UTC application timestamps

The MySQL pool uses UTC and the bootstrap session specifies UTC. API timestamps use ISO 8601. Presentation-layer timezone conversion is outside this API.

## ADR-005 — Complete schema, phased application

Phase 1 creates the full relational schema so relationships and constraints can be reviewed early. Business modules and endpoints remain unimplemented until their scheduled phase; schema presence does not imply API availability.

## ADR-006 — Minimal dependency logging

Phase 1 uses a small structured JSON logger with recursive key redaction. A production observability package may replace it later only if deployment requirements justify the dependency and the redaction contract remains intact.

## ADR-007 — Stateful access validation

Protected requests verify the signed access JWT and then load the current session/user/role from MySQL. This adds one identity query per protected request but makes logout, account lock, and role/status changes effective immediately. A later cache must preserve revocation semantics.

## ADR-008 — Refresh tokens in HttpOnly cookies

Refresh tokens are signed JWTs with unique JWT IDs, stored client-side only in scoped HttpOnly cookies and server-side only as SHA-256 hashes. Rotation locks the session row. Reuse of an old token commits session revocation and audit before returning an authentication error.
