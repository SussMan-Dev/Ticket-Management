# Ticket workflow

## State transitions

```text
NEW → RECEIVED → ASSIGNED → DIAGNOSING → WAITING_FOR_QUOTATION
  → WAITING_FOR_CUSTOMER_APPROVAL
    → WAITING_FOR_PARTS → REPAIRING → TESTING → COMPLETED
      → READY_FOR_DELIVERY → DELIVERED → CLOSED
    → REPAIRING
    → CUSTOMER_REJECTED → READY_FOR_DELIVERY or CLOSED
```

Selected active states may move to `ON_HOLD` and later return only to an allowed operational state. Cancellation is allowed only from the explicitly configured early/waiting states. `CLOSED` and `CANCELLED` are terminal.

## Required atomic changes

Every state change locks the ticket, validates its current state, updates the ticket, appends status history, and creates required notifications/audit entries in one transaction. Concurrent requests must not produce two transitions from the same prior state.

## Milestones

1. Customer or receptionist creates the ticket and records the device condition.
2. Manager assigns one active technician.
3. Technician diagnoses; manager approves the diagnosis, then Phase 6 owns quotation creation and approval.
4. Customer accepts or rejects the unexpired quotation.
5. The assigned technician requests parts. Inventory may fulfill in portions without allowing negative stock; the ticket resumes repair only when no open request remains.
6. The assigned technician records repair logs using fulfilled parts, then appends test outcomes. The latest named tests either complete technical work or return the ticket to repair.
7. Cashier invoices and records payment.
8. Receptionist delivers a paid device (or Manager records an audited unpaid exception), operational staff close the delivered ticket, and the customer may review after delivery.

`src/common/constants/ticket-status.ts` is the code-level source for transition candidates. Each owning service adds actor, resource, and current-state checks before using a candidate.

## Phase implementation boundaries

Phase 4 enforces actor/resource checks and implements ticket creation, `NEW → RECEIVED`, allowed cancellation, and manager hold/resume between `RECEIVED` and `ON_HOLD`. Phase 5 adds `RECEIVED → ASSIGNED`, `ASSIGNED → DIAGNOSING`, diagnosis submission to `WAITING_FOR_QUOTATION`, and revision back to `DIAGNOSING` through the owning Assignment/Diagnosis services. Phase 6 owns quotation/customer-decision transitions. Phase 7 owns `REPAIRING → WAITING_FOR_PARTS` when the assigned technician requests parts and `WAITING_FOR_PARTS → REPAIRING` after the final open request is fulfilled. Phase 8 owns `REPAIRING → TESTING` on the first test result and testing completion to either `COMPLETED` or `REPAIRING`. Phase 9 owns `COMPLETED → READY_FOR_DELIVERY` after full payment and the guarded `READY_FOR_DELIVERY → COMPLETED` reversal when a completed payment is refunded before handover. Phase 10 owns rejected-device return or paid/exception handover to `DELIVERED`, then guarded `DELIVERED → CLOSED`. The generic status endpoint continues to reject assignment, diagnosis, quotation, inventory, repair/testing, payment, delivery, and closure transitions even when they are candidates in `ALLOWED_TICKET_TRANSITIONS`.
