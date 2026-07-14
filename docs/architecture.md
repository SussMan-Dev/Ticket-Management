# Architecture

## Processing flow

```text
Route → Middleware → Controller → Service → Repository → MySQL
```

- Routes declare endpoints and attach authentication, authorization, and validation middleware.
- Middleware verifies transport-level concerns and never implements business workflows.
- Controllers read validated input, call one service operation, and return the common response envelope.
- Services enforce state transitions, role and ownership rules, and coordinate transactions.
- Repositories contain all raw SQL, use placeholders, select explicit columns, and accept a pool or transaction connection.
- Models are TypeScript types and constants, not ORM models.

## Foundation components

- `src/config/env.ts` validates process configuration once at startup.
- `src/config/database.ts` owns the MySQL connection pool and lifecycle checks.
- `src/common/utils/transaction.util.ts` guarantees commit, rollback, and connection release.
- `src/middlewares/error-handler.middleware.ts` maps expected and unexpected errors to stable API errors.
- `src/common/utils/logger.ts` emits structured JSON and redacts secret-like keys.
- `src/routes/index.ts` is the versioned API composition root.

## Module boundaries

Every business module will use route, controller, service, repository, model, schema, and DTO files. A module may depend on another module's service contract; it must not bypass that contract to manipulate another module's tables. Cross-module transactions are orchestrated by the service that owns the use case.

## Failure handling

Expected business failures use `AppError` subclasses. Unexpected errors are logged with request method and path; production responses hide internal details. Database errors are translated at the service/repository boundary before being exposed to clients.

## Runtime lifecycle

Startup validates environment values and checks MySQL before binding the HTTP port. `SIGINT` and `SIGTERM` stop accepting connections and close the pool, with a ten-second forced-exit guard.
