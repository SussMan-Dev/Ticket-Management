# ElectronicFixer Frontend

Production-oriented React client for the Repair Ticket Management System. The app is isolated under `frontend/`; it does not change backend code, the database, or business rules.

## Stack

- React 19, TypeScript strict, Vite 8, React Router 7
- TanStack Query for server state and mutation invalidation
- React Hook Form + Zod for client-side validation aligned with backend schemas
- Vitest, React Testing Library, and MSW
- A custom responsive, accessible design system with no runtime UI framework

## Setup

Requirements: Node.js 20+ and the backend running locally.

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

The Vite development server runs at `http://localhost:5173` and proxies `/api` to `VITE_API_PROXY_TARGET`.

### Environment

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | REST API prefix |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Development proxy target |
| `VITE_CURRENCY` | `VND` | ISO 4217 display currency; no currency is assumed in code |
| `VITE_TIME_ZONE` | `Asia/Bangkok` | IANA display time zone; API values remain UTC strings |

Do not put secrets in Vite environment variables: every `VITE_*` value is public in the browser bundle.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Routes and role flows

| Route | Roles | Capability |
|---|---|---|
| `/login`, `/register` | Public | Login and customer self-registration |
| `/` | Authenticated | Role-specific dashboard |
| `/profile` | Authenticated | Safe profile fields |
| `/users` | ADMIN | User list, staff creation, role/status control |
| `/customers`, `/customers/:id` | RECEPTIONIST, MANAGER | Customer lookup/intake |
| `/devices` | CUSTOMER, RECEPTIONIST, MANAGER | Scoped device create/list/soft-delete |
| `/tickets`, `/tickets/new`, `/tickets/:id` | Operational roles per backend | Ticket intake, detail, status history, attachments and workflow actions |
| `/tickets/:ticketId/quotations/:quotationId` | CUSTOMER, assigned TECHNICIAN, MANAGER | Phase 6 quotation detail and role/state actions backed by the API |
| `/parts` | TECHNICIAN, INVENTORY_STAFF, MANAGER | Role-safe catalog; inventory staff maintenance/movements; manager ledger view |
| `/part-requests` | TECHNICIAN, INVENTORY_STAFF, MANAGER | Own technician requests, inventory decisions/fulfillment, manager visibility |
| `/extension` | CASHIER | Explicit placeholder for the later payment phase |

Admin navigation intentionally excludes repair operations. Customer forms do not expose `customerId`, priority, or SLA dates. Technician and customer data remain scoped by backend ownership/active assignment checks; role-aware menus are UX only.

## Authentication model

- The access token exists only in module memory and is never written to local/session storage.
- Refresh token transport is the backend HttpOnly cookie; browser requests use `credentials: "include"`.
- Reload restoration calls `/auth/refresh-token` and then `/auth/me`.
- Concurrent 401 responses share one refresh promise. Each original request is retried once.
- A failed refresh clears the in-memory session and TanStack Query cache.
- 401, 403, 404, 409, and 422 envelopes are preserved as typed `ApiError` values. Conflicts and validation errors receive explicit UI guidance.

## Integrated backend APIs (Phases 1–7)

- Auth: register, login, refresh, logout, current user
- Users: list/create/update, status and role
- Customers: list/detail/create/update
- Devices: list/create/delete and category/brand catalogs
- Repair tickets: list/detail/create, receive, configured hold/resume, cancel, history and attachment metadata
- Assignments: assign/reassign
- Diagnoses: list/create/update/submit/revision/approve
- Quotations: list/detail/create/update/submit/approve/send/accept/reject
- Parts: catalog list/detail/create/update, stock-in, signed adjustment, and movement history
- Part requests: ticket-scoped create, scoped list/detail, approve, reject, and partial fulfillment

All UI calls go through typed feature API functions and centralized query keys. Components do not call `fetch` directly.

## Phase 6–7 quotation and inventory integration

- `quotation.gateway.ts` binds the pages to the implemented Phase 6 REST endpoints.
- Creating a draft sends only the expiry; the backend generates initial items from the approved diagnosis.
- Draft PART edits send only `partId` and quantity. Catalog descriptions, prices, line totals, and header totals remain server-authoritative.
- Role/status actions map to submit, approve, send, accept, and reject endpoints; successful mutations invalidate quotation, ticket, and status-history queries.
- Expired and superseded versions render read-only. The backend remains authoritative if browser time or cached ticket state is stale.
- Diagnosis and quotation PART lines use the active catalog rather than accepting raw numeric IDs.
- Technicians can create ticket requests from catalog selections. Inventory staff can manage stock and fulfill outstanding quantities; managers receive read-only visibility.
- Successful stock/request mutations invalidate the affected catalog, request, ticket, and status-history queries.

## Known backend contract gaps

- Managers can assign a `technicianId`, but Phase 5 exposes no manager-authorized technician lookup endpoint. The UI accepts a verified numeric ID and states the limitation.
- Cashier APIs remain planned for Phase 9, so the cashier navigation still uses an explicit extension point.

## Test coverage

The suite covers login/logout transport, single-flight refresh and one-time retry, error envelopes, protected/role routes, role navigation, customer ownership UI, assignment and diagnosis state rules, quotation role/status/expiry rules, parts/request routing and mutation invalidation, and 409/422 handling.
