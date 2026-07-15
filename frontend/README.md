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
| `VITE_ENABLE_QUOTATION_MOCK` | `true` | Enables the isolated Phase 6 in-memory adapter |

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
| `/tickets/:ticketId/quotations/:quotationId` | CUSTOMER, TECHNICIAN, MANAGER | Phase 6 mock quotation detail and state UI |
| `/extension` | INVENTORY_STAFF, CASHIER | Explicit placeholder; no unsupported operational UI |

Admin navigation intentionally excludes repair operations. Customer forms do not expose `customerId`, priority, or SLA dates. Technician and customer data remain scoped by backend ownership/active assignment checks; role-aware menus are UX only.

## Authentication model

- The access token exists only in module memory and is never written to local/session storage.
- Refresh token transport is the backend HttpOnly cookie; browser requests use `credentials: "include"`.
- Reload restoration calls `/auth/refresh-token` and then `/auth/me`.
- Concurrent 401 responses share one refresh promise. Each original request is retried once.
- A failed refresh clears the in-memory session and TanStack Query cache.
- 401, 403, 404, 409, and 422 envelopes are preserved as typed `ApiError` values. Conflicts and validation errors receive explicit UI guidance.

## Integrated backend APIs (Phases 1–5)

- Auth: register, login, refresh, logout, current user
- Users: list/create/update, status and role
- Customers: list/detail/create/update
- Devices: list/create/delete and category/brand catalogs
- Repair tickets: list/detail/create, receive, configured hold/resume, cancel, history and attachment metadata
- Assignments: assign/reassign
- Diagnoses: list/create/update/submit/revision/approve

All UI calls go through typed feature API functions and centralized query keys. Components do not call `fetch` directly.

## Phase 6 quotation boundary

The repository does not currently contain `src/modules/quotations/`, and the backend docs mark Phase 6 as planned. Therefore:

- No quotation REST endpoint or request DTO is invented.
- `quotation.gateway.ts` binds quotation pages to an in-memory mock adapter.
- Every mock screen is visibly labeled, data disappears on reload, and `source: "mock"` is explicit.
- Draft edit, supersession, status action visibility, confirmation dialogs, expiry/read-only behavior, and related query invalidation are ready for UI verification.
- Mock totals are never described as authoritative. When Phase 6 exists, replace the gateway with functions derived from its actual schema/DTO and render server-calculated totals.

## Known backend contract gaps

- Managers can assign a `technicianId`, but Phase 5 exposes no manager-authorized technician lookup endpoint. The UI accepts a verified numeric ID and states the limitation.
- Diagnosis accepts requested `partId` values, while the Parts catalog API is planned for Phase 7. The UI accepts verified IDs and does not invent a catalog endpoint.
- Inventory Staff and Cashier APIs are not mounted; only a navigation extension point exists.

## Test coverage

The suite covers login/logout transport, single-flight refresh and one-time retry, error envelopes, protected/role routes, role navigation, customer ownership UI, assignment and diagnosis state rules, quotation role/status/expiry rules, DRAFT editing, supersession, query invalidation, and 409/422 handling.
