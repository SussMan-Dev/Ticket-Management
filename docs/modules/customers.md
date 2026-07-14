# Customers

## Responsibility

Maintain customer profile data and provide staff lookup plus customer-scoped ticket/device views.

## Main entities

Customer user and customer profile.

## Main files

Implemented under `src/modules/customers/` using route, controller, service, repository, model, schema, and DTO files.

## Public APIs

Implemented in Phase 3: `GET /customers`, `GET /customers/:id`, `POST /customers`, `PATCH /customers/:id`, and `GET /customers/:id/devices`. `GET /customers/:id/tickets` remains deferred to Phase 4.

## Allowed roles

Customers access their own profile. Receptionists and managers search/view customers for intake. Admins manage the associated account, not repair history.

## Business rules

A customer profile maps one-to-one to a `CUSTOMER` user. Staff creation requires an initial policy-compliant password and atomically creates the user, profile, and audit record. Customer ownership comes from the authenticated identity, never from a request body alone. Only receptionists and managers can read or write staff notes; customer responses omit that field.

## State transitions

No independent lifecycle; availability follows the linked user account status and soft deletion policy.

## Database tables

`users`, `customer_profiles`, with read dependencies on `devices` and `repair_tickets`.

## Transactions

Required when creating both user and customer profile and when updating linked user/profile fields with an audit record.

## Dependencies

Users, devices, and repair tickets.

## Common errors

Customer not found, duplicate email/phone, linked user has wrong role, and cross-customer access.

## Security considerations

Staff search returns minimal contact fields. Notes are staff-visible only unless explicitly classified for customer display.
