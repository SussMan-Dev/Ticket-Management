# Users

## Responsibility

Manage staff accounts, safe profile fields, account status, and role assignment. This module was completed in Phase 2.

## Main entities

User, role, account status.

## Main files

`src/modules/users/user.route.ts`, `user.controller.ts`, `user.service.ts`, `user.repository.ts`, `user.model.ts`, `user.schema.ts`, and `user.dto.ts`.

## Public APIs

`GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, and `PATCH /users/:id/role`, mounted under `/api/v1`.

## Allowed roles

Admins list/create staff and change status/role. An authenticated user may update only explicitly allowed personal fields through the profile workflow.

## Business rules

Email and optional phone are unique. Staff creation excludes `CUSTOMER`. Deactivation does not delete history. Role/status changes revoke sessions and are audited. An administrator cannot disable/demote itself or remove the final active administrator.

## State transitions

Account status moves among `ACTIVE`, `INACTIVE`, and `LOCKED` only through admin-authorized operations.

## Database tables

`users`, `roles`, `auth_sessions`, and `audit_logs`.

## Transactions

Required for staff creation, profile audit changes, role/status changes, session revocation, and initial admin seed.

## Dependencies

Authentication and customer profiles.

## Common errors

User not found, duplicate identity fields, invalid role, self-lock prevention, and forbidden staff management.

## Security considerations

Responses use explicit safe columns, bounded pagination, parameterized filters, and server-side sort whitelists. Password and session hashes are never selected for list/detail APIs. Client role/status values are accepted only on dedicated admin endpoints and validated against seeded roles.
