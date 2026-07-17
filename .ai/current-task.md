# Current Task

## Goal

Fix the runtime failure on the invoice UI after the itemized invoice release.

## Status

Completed on 2026-07-16.

## Root cause

- The Vite frontend had already loaded the new itemized-invoice code, but localhost port 3000 was still served by a Node process started before the new backend route and response contract existed.
- The live `GET /invoices/:id` response therefore omitted `costBreakdown`, causing the invoice detail component to read missing runtime data. The new invoice-preview route also returned `ROUTE_NOT_FOUND`.

## Completed

- Replaced the stale localhost backend process with the workspace development server so current payment routes and response contracts are active.
- Verified the live invoice list still succeeds and the live invoice-detail response now contains an itemized `costBreakdown`.
- Verified the preview route is registered; a Manager receives the expected role denial instead of route-not-found.
- Added a defensive fallback to the shared invoice breakdown component so an older or temporarily mismatched backend response shows a reload message instead of crashing the page.
- Added regression coverage for the missing-breakdown fallback.
- No database, SQL, API contract, business rule, dependency, or authorization change was introduced.

## Verification

- [x] Live invoice detail returned HTTP 200 with `costBreakdown` and two cost lines
- [x] Live preview endpoint is registered and enforces Cashier authorization
- [x] Frontend typecheck passed
- [x] Frontend lint passed with zero warnings
- [x] All 44 frontend tests passed across 15 files
- [x] Frontend production build passed
