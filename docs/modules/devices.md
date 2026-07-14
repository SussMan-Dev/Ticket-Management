# Devices

## Responsibility

Manage customer-owned devices and the device category/brand references used at ticket intake.

## Main entities

Device, device category, and device brand.

## Main files

Implemented under `src/modules/devices/` using route, controller, service, repository, model, schema, and DTO files.

## Public APIs

Implemented in Phase 3: `GET /devices`, `GET /devices/:id`, `POST /devices`, `PATCH /devices/:id`, `DELETE /devices/:id`, `GET /devices/categories`, and `GET /devices/brands`.

## Allowed roles

Customers manage only their own devices. Receptionists and managers can list, create, update, and soft-delete devices for intake operations. Customers, receptionists, and managers can read active category/brand catalogs. Catalog administration remains a future admin capability.

## Business rules

Device creation requires an active customer and active category; the optional brand must also be active. Staff must explicitly select `customerId`, while customer requests are always scoped to the authenticated owner. Ticket creation requires an active, non-deleted device owned by the selected customer. Deleting a device is soft deletion and cannot erase linked ticket history.

## State transitions

Active → soft-deleted; categories and brands can be active or inactive without deleting existing references.

## Database tables

`devices`, `device_categories`, `device_brands`, and `users`.

## Transactions

Creation/update/delete use transactions around validation, row locking where needed, and persistence so catalog/ownership decisions are consistent. A future combined receptionist intake workflow must reuse the caller's transaction.

## Dependencies

Customers and repair tickets.

## Common errors

Device not found, category/brand inactive, ownership mismatch, and attempt to use a deleted device.

## Security considerations

IMEI and serial numbers are sensitive identifiers; expose them only to the owner and operational staff and never use them as authorization evidence.
