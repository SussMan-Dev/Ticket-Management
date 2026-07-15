# Current Task

## Goal

Allow authenticated users to choose and save their profile avatar directly from a local device file.

## Status

Completed on 2026-07-15.

## Delivered

- Added `POST /api/v1/users/:id/avatar` for self/Admin-scoped raw image upload and audited avatar updates.
- Added local image storage with configurable public URL, directory, and 5 MB default limit; generated files use random server-owned names.
- Accepted only JPEG, PNG, and WebP after checking both MIME type and file signature; SVG, empty files, mismatches, and oversize payloads are rejected.
- Served generated raster images with immutable caching, `nosniff`, and cross-origin resource policy suitable for the separate Vite development origin.
- Removed a previous locally managed avatar only after the new database value commits; database failures clean up the newly written file.
- Added a responsive avatar file picker with preview, file-name feedback, client validation, and immediate profile/header/sidebar refresh.
- Added configuration examples and ignored runtime upload files from version control.
- No package or database migration was required; existing `users.avatar_url` stores the generated public URL.

## Verification

- [x] Backend TypeScript typecheck passed
- [x] Backend production build passed
- [x] All 198 backend tests passed
- [x] Frontend TypeScript typecheck passed
- [x] Frontend lint passed with zero warnings
- [x] All 34 frontend tests passed
- [x] Frontend production build passed
- [x] File storage, MIME/signature validation, ownership, raw transport, and picker validation have regression tests
