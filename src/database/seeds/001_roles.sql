INSERT INTO roles (code, name, description)
VALUES
  ('CUSTOMER', 'Customer', 'Owns devices, creates repair requests, approves quotations, and reviews service.'),
  ('RECEPTIONIST', 'Receptionist', 'Receives devices, creates walk-in tickets, and records delivery.'),
  ('TECHNICIAN', 'Technician', 'Diagnoses and repairs tickets assigned to the technician.'),
  ('MANAGER', 'Manager', 'Assigns work, approves quotations, manages workflow, and views reports.'),
  ('ADMIN', 'Administrator', 'Manages staff accounts, roles, configuration, and audit access.'),
  ('INVENTORY_STAFF', 'Inventory Staff', 'Manages parts, stock movements, and ticket part requests.'),
  ('CASHIER', 'Cashier', 'Creates invoices, records payments, and processes approved refunds.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;
