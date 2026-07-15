# Current Task

## Goal

Allow technicians to select repair photos from device files and persist a repair address directly on each ticket, independently from the customer's profile address.

## Status

Completed on 2026-07-15.

## Delivered

- Added migration `003_add_repair_ticket_address.sql` and the canonical nullable `repair_tickets.repair_address` column for legacy compatibility.
- Made `repairAddress` required for every new ticket and exposed it across DTO/schema/model/repository/service/API/frontend contracts.
- Displayed the ticket-owned address in detail and added an editor: customers may edit while `NEW`; receptionists/managers may correct only the address on any non-terminal ticket.
- Added `POST /api/v1/repair-tickets/:id/attachment-files` for raw JPEG/PNG/WebP ticket image upload.
- Reused configurable local image storage with MIME/signature/size checks, random ticket-owned filenames, public URLs, and orphan cleanup when metadata persistence fails.
- Preserved ownership and role/type checks: an assigned technician can upload only `DURING_REPAIR` and `AFTER_REPAIR` images.
- Replaced the frontend URL form with a responsive local-file picker, preview, client validation, upload state, and image gallery.
- Applied migration 003 to the configured development database. Three existing legacy tickets remain without a guessed address and can be corrected through the authorized UI.

## Verification

- [x] Backend TypeScript typecheck passed
- [x] Backend production build passed
- [x] All 204 backend tests passed
- [x] Frontend TypeScript typecheck passed
- [x] Frontend lint passed with zero warnings
- [x] All 36 frontend tests passed
- [x] Frontend production build passed
- [x] Migration column verified against the configured MySQL database
- [x] Address ownership/edit rules, raw upload routing, signature validation, storage cleanup primitives, and file pickers have regression tests
