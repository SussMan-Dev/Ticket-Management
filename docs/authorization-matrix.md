# Authorization matrix

Legend: `Own` means only resources owned by the user; `Assigned` means an active technician assignment; `Manage` includes create/update actions within that role's responsibility.

| Capability | Customer | Receptionist | Technician | Manager | Admin | Inventory Staff | Cashier |
|---|---|---|---|---|---|---|---|
| Upload profile avatar | Own | Own | Own | Own | Own/Admin manage | Own | Own |
| Customer profile/device | Own | Manage | — | View | Manage accounts/catalog | — | — |
| Create repair ticket | Own | Manage | — | Manage | — | — | — |
| View repair ticket | Own | Operational | Assigned | All | Audit only | Parts context | Billing context |
| Receive/deliver device | Confirm own | Manage | — | Exception | — | — | — |
| Assign technician | — | — | — | Manage | — | — | — |
| Diagnose/repair/test | View | — | Assigned | Review | — | — | — |
| Approve quotation | Respond own | — | — | Manage | — | — | — |
| Move inventory | — | — | Request when assigned | View | — | Manage | — |
| Invoice/payment/refund | View own | — | — | Approve exceptions | — | — | Manage |
| Notifications | Own | Own | Own | Own | Own | Own | Own |
| Reports | — | — | — | All operational | — | Inventory only | — |
| User role/status | — | — | — | — | Manage | — | — |

Every endpoint first authenticates a signed access token, then checks its role, then the service checks ownership/assignment and current resource state. Client-supplied roles are ignored.

Phases 2 through 10 enforce this matrix through closure, review, notifications, and reports. Routes authenticate and check roles in middleware; services then enforce customer ownership, active technician assignment, diagnosis/log authorship, request ownership, current state, invoice/delivery/review ownership, notification recipient scope, cashier mutation scope, active-manager refund approval, and report role. Cashiers may list only completed tickets for billing lookup. Admin remains account/configuration-only and cannot use operational ticket endpoints.
