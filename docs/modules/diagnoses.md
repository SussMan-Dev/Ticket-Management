# Diagnoses

## Responsibility

Record technician findings, proposed work, labor estimate, risk, requested parts, submission, revision, and approval.

## Main entities

Diagnosis and diagnosis part.

## Main files

Implemented under `src/modules/diagnoses/` using the standard seven-file module structure.

## Public APIs

List/create diagnoses under a ticket; patch, submit, request revision, and approve diagnosis by ID. All are implemented in Phase 5.

## Allowed roles

The active assigned technician creates/edits/submits and must remain the diagnosis author. Managers request revision or approve. The owning customer receives only approved data with root cause, risk note, staff identity, and diagnosis-part notes removed.

## Business rules

Labor cost and estimates are non-negative. Requested parts must be active, positive, and unique within a diagnosis. Only one diagnosis may be open for a ticket. Submitted data becomes immutable except through manager-requested revision. Approval leaves the ticket at `WAITING_FOR_QUOTATION` for Phase 6 quotation creation.

## State transitions

Creating the first draft moves the ticket `ASSIGNED → DIAGNOSING`. Diagnosis state is `DRAFT → SUBMITTED → APPROVED` or `REVISION_REQUIRED`; the first revision edit returns the diagnosis to `DRAFT`. Submission moves the ticket `DIAGNOSING → WAITING_FOR_QUOTATION`; a revision request moves it back to `DIAGNOSING`.

## Database tables

`diagnoses`, `diagnosis_parts`, `parts`, `ticket_assignments`, and `repair_tickets`.

## Transactions

Create, edit, submit, revision, and approval use transactions. This keeps diagnosis/part replacement, status/history transitions, notifications, and approval audit records consistent.

## Dependencies

Assignments, repair tickets, parts, and quotations.

## Common errors

No active assignment, wrong technician, invalid diagnosis status, invalid part quantity, and approval conflict.

## Security considerations

Internal risk notes may differ from customer-visible text. Ownership and assignment checks occur even after role middleware.
