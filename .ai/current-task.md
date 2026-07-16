# Current Task

## Goal

Extend the customer-friendly frontend to every system role and standardize all displayed monetary values as Vietnamese đồng (`VNĐ`) without changing backend contracts.

## Status

Completed on 2026-07-16.

## Delivered

- Added role-specific dashboard themes, three-step workflow guidance, and task shortcuts for Receptionist, Technician, Manager, Admin, Inventory Staff, and Cashier.
- Replaced implementation-facing wording with plain Vietnamese in customer administration, account management, diagnosis, quotation, parts, inventory requests, reports, payment, and delivery screens.
- Improved inventory usability with Vietnamese stock status/transaction labels, clearer low-stock and adjustment copy, and role-aware parts/report descriptions.
- Standardized every displayed monetary value through the shared formatter using the `VNĐ` suffix; added `VNĐ` to monetary input labels and removed the obsolete configurable currency environment variable.
- Preserved all existing API calls, authorization, ownership, business rules, and backend-calculated monetary values.
- Updated frontend documentation and added regression coverage for the fixed Vietnamese currency format.

## Verification

- [x] Frontend TypeScript typecheck passed
- [x] Frontend lint passed with zero warnings
- [x] Frontend production build passed
- [x] All 39 frontend tests passed across 14 files
- [x] Git diff whitespace check passed
- [x] No backend, SQL, API, database, authorization, transaction, or package change was introduced
