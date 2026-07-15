# Current Task

## Goal

Fix the real-MySQL `Incorrect arguments to mysqld_stmt_execute` failure on paginated list pages, first observed at `GET /api/v1/users` from the frontend.

## Status

Completed on 2026-07-15.

## Root cause

The configured MySQL deployment rejects bound `LIMIT ? OFFSET ?` values through the prepared-statement protocol used by `mysql2.execute`, returning `ER_WRONG_ARGUMENTS`. Users, Customers, Devices, and Repair Tickets shared this pagination pattern.

## Delivered

- Changed only the paginated list SELECT in the four affected repositories from `pool.execute` to parameterized `pool.query`.
- Retained placeholder escaping for filters, limit, and offset; no request data is interpolated into SQL.
- Left count queries and all non-pagination repository statements unchanged.
- Kept SQL inside repository files and changed no API contract, database schema, authorization, or business rule.

## Verification

- [x] Real MySQL user list query passed and returned the existing user
- [x] Real MySQL customer, device, and repair-ticket list queries passed
- [x] TypeScript typecheck passed
- [x] All 100 backend tests passed
- [x] Running backend hot-reloaded successfully

## Next

Continue with backend Phase 6 quotations, then bind the existing frontend quotation gateway to its actual schema and DTOs.
