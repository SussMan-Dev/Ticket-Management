# ElectronicFixer Frontend

Production-oriented React client for the Repair Ticket Management System. The app is isolated under `frontend/`; it does not change backend code, the database, or business rules.

## Stack

- React 19, TypeScript strict, Vite 8, React Router 7
- TanStack Query for server state and mutation invalidation
- React Hook Form + Zod for client-side validation aligned with backend schemas
- Vitest, React Testing Library, and MSW
- A custom responsive, accessible design system with no runtime UI framework

The shared application shell keeps the sticky header, page content, and footer on one responsive content grid. Cards, forms, data tables, and page actions use common spacing and alignment rules across desktop and mobile views; authentication screens reuse the same branded footer in a compact layout.

The customer home follows a service-tracking portal pattern: clear repair steps, prominent request/progress actions, a latest-status summary, and direct links to devices and invoices. Staff dashboards use role-specific visual themes, three-step workflow guidance, and shortcuts for reception, technical work, management, administration, inventory, and cashier tasks. User-facing pages use plain Vietnamese instead of implementation terms and translate stored status/type codes before display. All monetary values are rendered consistently with the `VNĐ` suffix. The mobile drawer supports an explicit close control, Escape, scroll locking, and keyboard-visible focus states.

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
| `/profile` | Authenticated | Safe profile fields and local avatar upload |
| `/users` | ADMIN | User list, staff creation, role/status control |
| `/customers`, `/customers/:id` | RECEPTIONIST, MANAGER | Customer lookup/intake |
| `/devices` | CUSTOMER, RECEPTIONIST, MANAGER | Scoped device create/list/soft-delete |
| `/tickets`, `/tickets/new`, `/tickets/:id` | Operational roles per backend | Complete ticket workflow including assignment, diagnosis, quotation, repair/testing, delivery/closure, review, and timeline |
| `/tickets/:ticketId/quotations/:quotationId` | CUSTOMER, assigned TECHNICIAN, MANAGER | Phase 6 quotation detail and role/state actions backed by the API |
| `/parts` | TECHNICIAN, INVENTORY_STAFF, MANAGER | Role-safe catalog; inventory staff maintenance/movements; manager ledger view |
| `/part-requests` | TECHNICIAN, INVENTORY_STAFF, MANAGER | Own technician requests, inventory decisions/fulfillment, manager visibility |
| `/invoices`, `/invoices/:invoiceId` | CUSTOMER own, CASHIER, MANAGER | Invoice list/detail, partial collection, immutable history, and approved whole-payment refund |
| `/notifications` | Authenticated | Recipient-scoped updates and read state |
| `/reports` | MANAGER, INVENTORY_STAFF | Role-specific operational and inventory reporting |

Admin navigation intentionally excludes repair operations. Customer forms do not expose `customerId`, priority, or SLA dates. Technician and customer data remain scoped by backend ownership/active assignment checks; role-aware menus are UX only.

## Authentication model

- The access token exists only in module memory and is never written to local/session storage.
- Customer registration confirms the password in-browser; the confirmation field is validated locally and never sent to the API.
- Refresh token transport is the backend HttpOnly cookie; browser requests use `credentials: "include"`.
- Reload restoration calls `/auth/refresh-token` and then `/auth/me`.
- Concurrent 401 responses share one refresh promise. Each original request is retried once.
- A failed refresh clears the in-memory session and TanStack Query cache.
- 401, 403, 404, 409, and 422 envelopes are preserved as typed `ApiError` values. Conflicts and validation errors receive explicit UI guidance.

## Integrated backend APIs (Phases 1–10)

- Auth: register, login, refresh, logout, current user
- Users: list/create/update, validated JPEG/PNG/WebP avatar upload, status and role
- Customers: list/detail/create/update
- Devices: list/create/delete and category/brand catalogs
- Repair tickets: list/detail/create, receive, configured hold/resume, cancel, history and attachment metadata
- Assignments: assign/reassign
- Diagnoses: list/create/update/submit/revision/approve
- Quotations: list/detail/create/update/submit/approve/send/accept/reject
- Parts: catalog list/detail/create/update, stock-in, signed adjustment, and movement history
- Part requests: ticket-scoped create, scoped list/detail, approve, reject, and partial fulfillment
- Repair actions: scoped repair logs, fulfilled-part attribution, append-only tests, technical completion/rework, and aggregated timeline
- Billing: server-calculated invoice list/detail/create, partial/full payments, active manager refund approvers, and whole-payment refund
- Notifications: paginated list, unread count, mark-one, and mark-all read state
- Delivery: normal paid handover, audited Manager exception, proof metadata, final closure, and customer-safe view
- Reviews: owner-only post-delivery creation and seven-day editing with authorized staff reads
- Reports: Manager dashboard/revenue/performance/timing and Manager/Inventory parts usage/low-stock

All UI calls go through typed feature API functions and centralized query keys. Components do not call `fetch` directly.

## Phase 6–10 workflow integration

- `quotation.gateway.ts` binds the pages to the implemented Phase 6 REST endpoints.
- Creating a draft sends only the expiry; the backend generates initial items from the approved diagnosis.
- Draft PART edits send only `partId` and quantity. Catalog descriptions, prices, line totals, and header totals remain server-authoritative.
- Role/status actions map to submit, approve, send, accept, and reject endpoints; successful mutations invalidate quotation, ticket, and status-history queries.
- A sent, unexpired quotation shows accept/reject controls directly on the owning customer's ticket page as well as on quotation detail.
- Expired and superseded versions render read-only. The backend remains authoritative if browser time or cached ticket state is stale.
- Diagnosis and quotation PART lines use the active catalog rather than accepting raw numeric IDs.
- Technicians can create ticket requests from catalog selections. Inventory staff can manage stock and fulfill outstanding quantities; managers receive read-only visibility.
- Successful stock/request mutations invalidate the affected catalog, request, ticket, and status-history queries.
- Assigned technicians record repair logs only from fulfilled parts; finishing a log makes it read-only. Customers receive the backend-sanitized progress view.
- Tests are appended after a finished repair log. The completion action renders the server outcome and refreshes ticket, status-history, repair/test, and timeline caches.
- Ticket detail uses the Phase 8 aggregated timeline instead of presenting status history as the complete operational history.
- Cashiers choose only completed tickets for invoice creation; invoice totals are rendered from the server snapshot and are never editable in the browser.
- Payment/refund mutations invalidate invoice, payment, ticket, and history caches so delivery readiness always follows backend state.
- Manager assignment uses a server-filtered active/unlocked technician selector rather than a raw numeric ID.
- Notification counts refresh in the app header; reference links mark items read and navigate to the related ticket or invoice.
- Ticket detail owns handover, closure, review, and the final invoice/payment/delivery/review timeline events.
- Report pages enforce role-specific endpoints and bounded date filters without exposing customer PII.

## Scope status

All planned Phase 1–10 backend contracts are connected to the frontend. Further UI work should be treated as a new product extension or deployment/UAT task.

## Test coverage

The suite covers login/logout transport, single-flight refresh and one-time retry, error envelopes, protected/role routes, role navigation, customer ownership UI, assignment and diagnosis state rules, quotation role/status/expiry rules, parts/request routing, repair/test/timeline mutation invalidation, billing money/refund validation and cache invalidation, and 409/422 handling. Phase 10 backend tests cover notification recipient scope, delivery/payment exception/closure, review ownership/edit policy, and report roles/ranges.
