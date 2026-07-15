# Current Task

## Goal

Localize all durable workflow notifications into Vietnamese for Vietnamese users.

## Status

Completed on 2026-07-15.

## Delivered

- Localized notification titles and content created by assignment, diagnosis, quotation, inventory, repair/testing, payment, delivery, and ticket-closure workflows.
- Localized notification list/count/read API response messages and the recipient-scoped not-found error without changing stable error or notification type codes.
- Added response-time localization for every known legacy English notification template, keeping stored history untouched while presenting existing notifications consistently in Vietnamese.
- Documented the Vietnamese notification-content contract and added regression coverage for legacy notification serialization.

## Verification

- [x] Backend TypeScript typecheck passed
- [x] Backend production build passed
- [x] All 205 backend tests passed
- [x] All 51 notification-producing workflow and notification module tests passed
- [x] No SQL was added outside repositories and no authorization or transaction boundary changed
- [x] Notification module documentation and task history were updated
