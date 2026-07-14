# Diagnoses

## Responsibility

Record technician findings, proposed work, labor estimate, risk, requested parts, submission, revision, and approval.

## Main entities

Diagnosis and diagnosis part.

## Main files

Planned under `src/modules/diagnoses/` using the standard seven-file module structure.

## Public APIs

List/create diagnoses under a ticket; patch, submit, request revision, and approve diagnosis by ID. Planned for Phase 5.

## Allowed roles

The active technician creates/edits/submits. Managers request revision or approve. The owning customer receives only approved customer-safe diagnosis data.

## Business rules

Labor cost and estimates are non-negative. Submitted data becomes immutable except through revision. Approval moves the ticket to quotation preparation.

## State transitions

`DRAFT` → `SUBMITTED` → `APPROVED` or `REVISION_REQUIRED`; revision returns to draft editing before resubmission.

## Database tables

`diagnoses`, `diagnosis_parts`, `parts`, `ticket_assignments`, and `repair_tickets`.

## Transactions

Required when submission/approval also changes ticket status and writes history.

## Dependencies

Assignments, repair tickets, parts, and quotations.

## Common errors

No active assignment, wrong technician, invalid diagnosis status, invalid part quantity, and approval conflict.

## Security considerations

Internal risk notes may differ from customer-visible text. Ownership and assignment checks occur even after role middleware.
