# Conventions

## TypeScript

Use strict typing, explicit boundary types, `async`/`await`, and named exports. Database rows and DTOs are different types. Never expose password or refresh-token hashes. Constants use `UPPER_SNAKE_CASE`; files and URL paths use kebab-case; variables and functions use camelCase.

## Modules

Each implemented module contains route, controller, service, repository, model, schema, and DTO files. Routes contain no business logic. Controllers do not call repositories. Services do not import Express types. Repositories do not know about HTTP.

## SQL

Use raw parameterized SQL with `mysql2/promise`. Select explicit columns. Keep SQL formatted as multiline strings in repositories. Dynamic filters build condition and parameter arrays; dynamic sort identifiers come from a fixed map. Multi-step services pass one `PoolConnection` to all repositories.

## Errors and responses

Throw a typed application error with a stable uppercase code. Controllers use the shared response helper. Do not leak stack traces or database messages. Error details should identify invalid fields without echoing secrets.

## Tests

Unit-test state transitions, authorization, calculations, and validation. Integration-test repositories against an isolated MySQL database. API tests assert status, response envelope, and forbidden cross-owner access. Tests must not depend on execution order.

## Documentation changes

Update the affected module document, `.ai/current-task.md`, `.ai/module-status.md`, and `.ai/task-history.md`. Update maps when endpoints, tables, dependencies, or file structure changes.
