# AGENTS.md

## Project

Repair Ticket Management System built with Node.js, Express,
TypeScript, MySQL, mysql2/promise and raw SQL.

## Architecture

Route
→ Middleware
→ Controller
→ Service
→ Repository
→ MySQL

## Before editing

Read these files first:

1. `.ai/project-context.md`
2. `.ai/code-map.md`
3. `.ai/current-task.md`
4. `.ai/database-map.md`
5. `.ai/api-map.md`
6. `docs/business-rules.md`
7. The documentation file for the affected module

Do not scan the entire repository unless these files are insufficient.

## Layer rules

- Routes only declare endpoints and middleware.
- Controllers handle HTTP input and output.
- Services contain business logic.
- Repositories contain raw SQL.
- Models contain TypeScript interfaces and enums.
- Controllers must not call repositories directly.
- Services must not access Express request or response objects.
- SQL must not exist outside repository files.

## Database rules

- Use mysql2/promise.
- Use parameterized queries.
- Never use SELECT *.
- Use database transactions for multi-step operations.
- Do not allow negative inventory.
- Preserve status and assignment history.
- Never hard-delete financial or audit records.

## Security rules

- Validate every external input.
- Check both role and resource ownership.
- Never return password hashes or refresh token hashes.
- Do not trust role information sent from the client.
- JWT role must be verified from a valid signed token.

## Change rules

- Change the smallest number of files possible.
- Do not refactor unrelated modules.
- Do not rename files without a strong reason.
- Do not install a new package before checking package.json.
- Update documentation after structural or business-rule changes.
- Update `.ai/current-task.md` after every task.
- Update `.ai/task-history.md` after completing a feature.

## Completion checklist

Before marking a task complete:

1. TypeScript compiles.
2. Relevant tests pass.
3. No SQL exists outside repositories.
4. Authorization is checked.
5. Transactions are used where required.
6. Documentation is updated.
7. `.ai/current-task.md` reflects the new status.
