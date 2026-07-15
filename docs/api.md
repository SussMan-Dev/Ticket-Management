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
| GET | `/api/v1/customers` | RECEPTIONIST, MANAGER | Paginated customer lookup |
| GET | `/api/v1/customers/:id` | Own CUSTOMER, RECEPTIONIST, MANAGER | Customer profile detail |
| POST | `/api/v1/customers` | RECEPTIONIST, MANAGER | Create customer/profile atomically |
| PATCH | `/api/v1/customers/:id` | Own CUSTOMER, RECEPTIONIST, MANAGER | Update allowed profile fields |
| GET | `/api/v1/customers/:id/tickets` | Own CUSTOMER, RECEPTIONIST, MANAGER | Customer ticket collection |
| GET | `/api/v1/customers/:id/devices` | Own CUSTOMER, RECEPTIONIST, MANAGER | Customer device collection |
| GET | `/api/v1/devices` | CUSTOMER own, RECEPTIONIST, MANAGER | Scoped device list |
| GET | `/api/v1/devices/categories` | CUSTOMER, RECEPTIONIST, MANAGER | Active device categories |
| GET | `/api/v1/devices/brands` | CUSTOMER, RECEPTIONIST, MANAGER | Active device brands |
| GET | `/api/v1/devices/:id` | Owner, RECEPTIONIST, MANAGER | Device detail |
| POST | `/api/v1/devices` | CUSTOMER own, RECEPTIONIST, MANAGER | Create device |
| PATCH | `/api/v1/devices/:id` | Owner, RECEPTIONIST, MANAGER | Update device |
| DELETE | `/api/v1/devices/:id` | Owner, RECEPTIONIST, MANAGER | Soft-delete device |
| GET | `/api/v1/repair-tickets` | CUSTOMER own, assigned TECHNICIAN, operational staff | Scoped ticket list |
| POST | `/api/v1/repair-tickets` | CUSTOMER, RECEPTIONIST, MANAGER | Create ticket/intake |
| GET | `/api/v1/repair-tickets/:id` | Owner, assigned TECHNICIAN, operational staff | Ticket detail |
| PATCH | `/api/v1/repair-tickets/:id` | Owner/state-bound staff | Update allowed intake fields |
| POST | `/api/v1/repair-tickets/:id/receive` | RECEPTIONIST | Receive a new ticket |
| POST | `/api/v1/repair-tickets/:id/change-status` | MANAGER | Configured hold/resume only |
| POST | `/api/v1/repair-tickets/:id/cancel` | Eligible owner, MANAGER | Cancel in an allowed state |
| GET | `/api/v1/repair-tickets/:id/status-history` | Same visibility as ticket | Immutable status history |
| GET | `/api/v1/repair-tickets/:id/attachments` | Same visibility as ticket | Attachment metadata |
| POST | `/api/v1/repair-tickets/:id/attachments` | Role/type/state scoped | Create attachment metadata |
| POST | `/api/v1/repair-tickets/:id/assign` | MANAGER | Assign an active technician atomically |
| POST | `/api/v1/repair-tickets/:id/reassign` | MANAGER | Replace the active assignment atomically |
| GET | `/api/v1/repair-tickets/:ticketId/diagnoses` | Owner approved-only, assigned TECHNICIAN, MANAGER | Scoped diagnosis list |
| POST | `/api/v1/repair-tickets/:ticketId/diagnoses` | Assigned TECHNICIAN | Create a diagnosis draft |
| PATCH | `/api/v1/diagnoses/:id` | Assigned diagnosis author | Edit a draft/revision diagnosis |
| POST | `/api/v1/diagnoses/:id/submit` | Assigned diagnosis author | Submit diagnosis for review |
| POST | `/api/v1/diagnoses/:id/request-revision` | MANAGER | Return diagnosis for revision |
| POST | `/api/v1/diagnoses/:id/approve` | MANAGER | Approve submitted diagnosis |

## Remaining endpoint groups

- Quotations: versioned quotation workflows and customer response.
- Inventory and repair: parts, stock movement, part requests, repair logs, and test results.
- Billing and delivery: invoices, partial payments, refunds, handover, and reviews.
- Reports: dashboard, revenue, repair time, technician performance, parts usage, and low stock.

Phases 1 through 5 are mounted. `.ai/api-map.md` records exact role, transaction, request, and future-path details.

## Authentication transport

Access tokens are returned in JSON and sent as `Authorization: Bearer`. Refresh tokens are never returned in JSON; they use an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth` and marked `Secure` in production. Every protected request validates both the JWT and current database session/user state.

## Pagination

List endpoints use one-based `page`, a default `limit` of 20, and a maximum of 100. Metadata returns `page`, `limit`, `total`, and `totalPages`. Sort fields are endpoint-specific server whitelists.

## Security headers and CORS

Helmet is enabled. CORS origins are read from the comma-separated `CORS_ORIGINS` environment setting; browser requests with other origins receive no CORS grant. JSON and form bodies are limited by `REQUEST_BODY_LIMIT`.
