# Authorization matrix

Legend: `Own` means only resources owned by the user; `Assigned` means an active technician assignment; `Manage` includes create/update actions within that role's responsibility.

| Capability | Customer | Receptionist | Technician | Manager | Admin | Inventory Staff | Cashier |
|---|---|---|---|---|---|---|---|
| Customer profile/device | Own | Manage | — | View | Manage accounts/catalog | — | — |
| Create repair ticket | Own | Manage | — | Manage | — | — | — |
| View repair ticket | Own | Operational | Assigned | All | Audit only | Parts context | Billing context |
| Receive/deliver device | Confirm own | Manage | — | Exception | — | — | — |
| Assign technician | — | — | — | Manage | — | — | — |
| Diagnose/repair/test | View | — | Assigned | Review | — | — | — |
| Approve quotation | Respond own | — | — | Manage | — | — | — |
| Move inventory | — | — | Request | View/approve policy | — | Manage | — |
| Invoice/payment/refund | View own | — | — | Approve exceptions | — | — | Manage |
| Reports | — | — | Own performance when allowed | All operational | System/audit | Inventory reports | Billing reports |
| User role/status | — | — | — | — | Manage | — | — |

Every endpoint first authenticates a signed access token, then checks its role, then the service checks ownership/assignment and current resource state. Client-supplied roles are ignored.

Phases 2 through 5 enforce this matrix for Auth, Users, Customers, Devices, Repair Tickets, Assignments, and Diagnoses. Routes authenticate and check roles in middleware; services then enforce customer ownership, active technician assignment, diagnosis authorship, current state, and manager-only reviews. Admin remains account/configuration-only and cannot use operational ticket endpoints.
