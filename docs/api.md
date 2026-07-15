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
| POST | `/api/v1/users/:id/avatar` | Self or ADMIN | Upload a validated JPEG, PNG, or WebP avatar |
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

Additional implemented Phase 6–10 groups:

- Ticket-scoped quotations plus quotation detail/edit/submit/approve/send and owner response.
- Parts catalog, stock-in/adjustment ledger, movement history, and technician part requests with inventory fulfillment.
- Ticket-scoped repair logs, test results, complete-testing, and aggregated timeline; unfinished log edits live under `/api/v1/repair-logs/:id`.
- Invoice list/detail and ticket-scoped creation, invoice payment history/collection, active refund approver lookup, and manager-approved whole-payment refund.

Phase 9 billing endpoints:

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/invoices` | Own CUSTOMER, CASHIER, MANAGER | Paginated invoice list with search/status/customer/ticket filters |
| GET | `/api/v1/invoices/:id` | Own CUSTOMER, CASHIER, MANAGER | Invoice totals, live balance, ticket, customer, and creator |
| POST | `/api/v1/repair-tickets/:ticketId/invoices` | CASHIER | Create from the accepted quotation snapshot |
| GET | `/api/v1/invoices/:id/payments` | Own CUSTOMER, CASHIER, MANAGER | Immutable payment history |
| POST | `/api/v1/invoices/:id/payments` | CASHIER | Record a partial/full payment with `amount`, `method`, optional reference/note |
| GET | `/api/v1/payments/refund-approvers` | CASHIER | Minimal active manager choices for approval |
| POST | `/api/v1/payments/:id/refund` | CASHIER | Refund one whole payment with `managerApprovalId` and `reason` |

Phase 10 adds authenticated notification list/count/read state; ticket-scoped handover, delivery view, closure, and review; review update; and seven `/reports/*` aggregates. Manager assignment also exposes `/repair-tickets/assignable-technicians` for safe UI selection.

Phases 1 through 10 are mounted. `.ai/api-map.md` records exact roles, transactions, requests, and business rules.

Avatar upload sends the image bytes directly as the request body with `Content-Type: image/jpeg`, `image/png`, or `image/webp`; it is not a JSON or multipart request. The default limit is 5 MB and is configurable with `IMAGE_UPLOAD_MAX_BYTES`.

## Authentication transport

Access tokens are returned in JSON and sent as `Authorization: Bearer`. Refresh tokens are never returned in JSON; they use an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth` and marked `Secure` in production. Every protected request validates both the JWT and current database session/user state.

## Pagination

List endpoints use one-based `page`, a default `limit` of 20, and a maximum of 100. Metadata returns `page`, `limit`, `total`, and `totalPages`. Sort fields are endpoint-specific server whitelists.

## Security headers and CORS

Helmet is enabled. CORS origins are read from the comma-separated `CORS_ORIGINS` environment setting; browser requests with other origins receive no CORS grant. JSON and form bodies are limited by `REQUEST_BODY_LIMIT`.
