# Authentication

## Responsibility

Register customers, authenticate credentials, issue short-lived access tokens, rotate refresh tokens, and revoke one or all sessions. This module was completed in Phase 2.

## Main entities

User, role, authentication session, access-token payload.

## Main files

`src/modules/auth/auth.route.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.model.ts`, `auth.schema.ts`, and `auth.dto.ts`. Shared security code is in `src/common/utils/{jwt,password,refresh-token}.util.ts` and the authentication/rate-limit middleware.

## Public APIs

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh-token`, `POST /auth/logout`, `POST /auth/logout-all`, and `GET /auth/me`. All are mounted under `/api/v1`.

## Allowed roles

Registration and login are public. Refresh requires a valid session token. Logout and `/me` require authentication.

## Business rules

Only customers self-register. Staff accounts are admin-created. Passwords use bcrypt; refresh tokens use SHA-256 hashes. Refresh always rotates with a unique JWT ID and invalidates the old value. Five failed logins temporarily lock an account for 15 minutes by default, while all client-facing login failures remain generic.

## State transitions

Session: active → rotated, revoked, or expired. Reuse of an old refresh token revokes the session. Account administrative status, temporary lock, soft deletion, and session state are checked before protected access.

## Database tables

`users`, `roles`, `auth_sessions`, and `audit_logs`.

## Transactions

Required for registration plus customer profile/audit, login plus session/reset, refresh rotation/reuse revocation, logout, and logout-all.

## Dependencies

Users module, JWT configuration, bcrypt, and notification/audit infrastructure.

## Common errors

Invalid credentials, inactive account, expired token, revoked session, reused refresh token, and duplicate email/phone.

## Security considerations

Use generic login failures, IP rate limiting, account-level locking, independent JWT secrets, issuer/audience and HS256 whitelisting. Access tokens use Bearer authentication. Refresh tokens exist only in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production); raw refresh tokens and all hashes are never logged or returned in JSON. The in-memory limiter must use a shared store before horizontally scaled production deployment.
