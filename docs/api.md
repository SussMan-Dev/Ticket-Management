# API

## Contract

Base URL: `/api/v1`. JSON success responses contain `success`, `message`, `data`, and `meta`. Errors contain `success`, `message`, and `error` with stable `code` and optional `details`. Validation failures use HTTP 422; authentication uses 401; authorization uses 403; missing resources use 404; conflicts use 409.

## Implemented endpoints

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Process liveness and uptime |
| POST | `/api/v1/auth/register` | Public | Register a customer account/profile |
| POST | `/api/v1/auth/login` | Public, rate-limited | Create a session and issue tokens |
| POST | `/api/v1/auth/refresh-token` | Refresh cookie | Rotate refresh token and issue access token |
| POST | `/api/v1/auth/logout` | Bearer access token | Revoke current session |
| POST | `/api/v1/auth/logout-all` | Bearer access token | Revoke all user sessions |
| GET | `/api/v1/auth/me` | Bearer access token | Current safe user |
| GET | `/api/v1/users` | ADMIN | Paginated/filterable user list |
| GET | `/api/v1/users/:id` | ADMIN | Safe user detail |
| POST | `/api/v1/users` | ADMIN | Create a staff account |
| PATCH | `/api/v1/users/:id` | Self or ADMIN | Update safe profile fields |
| PATCH | `/api/v1/users/:id/status` | ADMIN | Change status and revoke sessions |
| PATCH | `/api/v1/users/:id/role` | ADMIN | Change role and revoke sessions |

## Planned endpoint groups

- Customers and devices: profiles, device ownership, categories, brands, and device CRUD.
- Repair tickets: create, list, detail, receive, assign, reassign, transition, cancel, history, and timeline.
- Diagnoses and quotations: versioned diagnosis/quotation workflows and customer response.
- Inventory and repair: parts, stock movement, part requests, repair logs, and test results.
- Billing and delivery: invoices, partial payments, refunds, handover, and reviews.
- Reports: dashboard, revenue, repair time, technician performance, parts usage, and low stock.

Auth and Users were mounted in Phase 2. Remaining groups are planned; `.ai/api-map.md` records their exact future paths and implementation state.

## Authentication transport

Access tokens are returned in JSON and sent as `Authorization: Bearer`. Refresh tokens are never returned in JSON; they use an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth` and marked `Secure` in production. Every protected request validates both the JWT and current database session/user state.

## Pagination

List endpoints use one-based `page`, a default `limit` of 20, and a maximum of 100. Metadata returns `page`, `limit`, `total`, and `totalPages`. Sort fields are endpoint-specific server whitelists.

## Security headers and CORS

Helmet is enabled. CORS origins are read from the comma-separated `CORS_ORIGINS` environment setting; browser requests with other origins receive no CORS grant. JSON and form bodies are limited by `REQUEST_BODY_LIMIT`.
