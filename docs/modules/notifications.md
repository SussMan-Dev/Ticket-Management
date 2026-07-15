# Notifications

## Responsibility

Persist workflow milestones and expose recipient-scoped notification list, unread count, and read-state operations.

## Main entities

Notification with type, safe user-facing content, optional resource reference, read state, and timestamps.

## Main files

Read APIs are implemented under `src/modules/notifications/` using the standard seven-file structure. Event-producing modules write their own notification row inside the owning business transaction.

## Public APIs

`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, and `POST /notifications/read-all`.

## Allowed roles

Every authenticated role may access only notifications whose `user_id` matches its authenticated user ID.

## Business rules

List pagination and optional `isRead` filter are validated. Marking an already-read notification is idempotent. Cross-recipient IDs return not found rather than revealing existence.

## Database tables

`notifications`; event producers may share their owning transaction with ticket, assignment, quotation, payment, delivery, or audit tables.

## Security considerations

Never include secrets, password/session material, customer data unrelated to the recipient, or internal-only notes in notification content. Never trust a client-provided recipient ID.
