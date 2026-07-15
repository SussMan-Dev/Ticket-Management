-- Repair Ticket Management System
-- Target: MySQL 8.0+, InnoDB, UTC timestamps, utf8mb4.
-- Run this file after selecting the database configured by DB_NAME.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
  avatar_url VARCHAR(500) NULL,
  last_login_at DATETIME NULL,
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
  INDEX idx_users_role_status (role_id, status),
  INDEX idx_users_locked_until (locked_until),
  INDEX idx_users_deleted_at (deleted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(500) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_auth_sessions_user_id (user_id),
  INDEX idx_auth_sessions_expires_at (expires_at),
  INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE customer_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  address VARCHAR(500) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE device_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE device_brands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NULL,
  model VARCHAR(150) NULL,
  serial_number VARCHAR(191) NULL,
  imei VARCHAR(50) NULL,
  color VARCHAR(50) NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_devices_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT fk_devices_category FOREIGN KEY (category_id) REFERENCES device_categories (id),
  CONSTRAINT fk_devices_brand FOREIGN KEY (brand_id) REFERENCES device_brands (id),
  INDEX idx_devices_customer_id (customer_id),
  INDEX idx_devices_serial_number (serial_number),
  INDEX idx_devices_imei (imei),
  INDEX idx_devices_deleted_at (deleted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE repair_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_code VARCHAR(30) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  device_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  customer_issue TEXT NOT NULL,
  repair_address VARCHAR(500) NULL,
  initial_condition TEXT NULL,
  accessories_received TEXT NULL,
  status VARCHAR(50) NOT NULL,
  priority ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
  expected_diagnosis_at DATETIME NULL,
  expected_completion_at DATETIME NULL,
  received_at DATETIME NULL,
  completed_at DATETIME NULL,
  delivered_at DATETIME NULL,
  closed_at DATETIME NULL,
  cancellation_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_repair_tickets_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT fk_repair_tickets_device FOREIGN KEY (device_id) REFERENCES devices (id),
  CONSTRAINT fk_repair_tickets_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  INDEX idx_repair_tickets_customer_id (customer_id),
  INDEX idx_repair_tickets_device_id (device_id),
  INDEX idx_repair_tickets_status (status),
  INDEX idx_repair_tickets_created_at (created_at),
  INDEX idx_repair_tickets_status_priority (status, priority),
  INDEX idx_repair_tickets_deleted_at (deleted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE ticket_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  attachment_type ENUM(
    'BEFORE_REPAIR',
    'DURING_REPAIR',
    'AFTER_REPAIR',
    'CUSTOMER_ATTACHMENT',
    'DELIVERY_PROOF'
  ) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NULL,
  mime_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_ticket_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users (id),
  INDEX idx_ticket_attachments_ticket_id (ticket_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE ticket_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NULL,
  CONSTRAINT fk_ticket_assignments_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_ticket_assignments_technician FOREIGN KEY (technician_id) REFERENCES users (id),
  CONSTRAINT fk_ticket_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id),
  INDEX idx_ticket_assignments_ticket_active (ticket_id, is_active),
  INDEX idx_ticket_assignments_technician_active (technician_id, is_active)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE ticket_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_status_history_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_ticket_status_history_user FOREIGN KEY (changed_by) REFERENCES users (id),
  INDEX idx_ticket_status_history_ticket_id (ticket_id),
  INDEX idx_ticket_status_history_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE diagnoses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  actual_issue TEXT NOT NULL,
  root_cause TEXT NULL,
  proposed_solution TEXT NOT NULL,
  labor_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  estimated_hours DECIMAL(8, 2) NULL,
  data_loss_risk BOOLEAN NOT NULL DEFAULT FALSE,
  risk_note TEXT NULL,
  status ENUM('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED') NOT NULL DEFAULT 'DRAFT',
  submitted_at DATETIME NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_diagnoses_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_diagnoses_technician FOREIGN KEY (technician_id) REFERENCES users (id),
  CONSTRAINT fk_diagnoses_approved_by FOREIGN KEY (approved_by) REFERENCES users (id),
  CONSTRAINT chk_diagnoses_labor_cost CHECK (labor_cost >= 0),
  CONSTRAINT chk_diagnoses_estimated_hours CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  INDEX idx_diagnoses_ticket_id (ticket_id),
  INDEX idx_diagnoses_technician_status (technician_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE parts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'piece',
  purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  minimum_stock INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_parts_purchase_price CHECK (purchase_price >= 0),
  CONSTRAINT chk_parts_selling_price CHECK (selling_price >= 0),
  CONSTRAINT chk_parts_quantity_on_hand CHECK (quantity_on_hand >= 0),
  CONSTRAINT chk_parts_minimum_stock CHECK (minimum_stock >= 0),
  INDEX idx_parts_name (name),
  INDEX idx_parts_active_stock (is_active, quantity_on_hand, minimum_stock)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE diagnosis_parts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  part_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_diagnosis_parts_diagnosis FOREIGN KEY (diagnosis_id) REFERENCES diagnoses (id),
  CONSTRAINT fk_diagnosis_parts_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT chk_diagnosis_parts_quantity CHECK (quantity > 0),
  UNIQUE KEY uk_diagnosis_parts (diagnosis_id, part_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE quotations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  version INT NOT NULL,
  status ENUM(
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'SUPERSEDED'
  ) NOT NULL DEFAULT 'DRAFT',
  labor_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  parts_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  sent_at DATETIME NULL,
  customer_responded_at DATETIME NULL,
  customer_response_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quotations_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_quotations_diagnosis FOREIGN KEY (diagnosis_id) REFERENCES diagnoses (id),
  CONSTRAINT fk_quotations_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_quotations_approved_by FOREIGN KEY (approved_by) REFERENCES users (id),
  CONSTRAINT chk_quotations_version CHECK (version > 0),
  CONSTRAINT chk_quotations_amounts CHECK (
    labor_amount >= 0 AND parts_amount >= 0 AND discount_amount >= 0
    AND tax_amount >= 0 AND total_amount >= 0
  ),
  UNIQUE KEY uk_quotations_ticket_version (ticket_id, version),
  INDEX idx_quotations_ticket_status (ticket_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE quotation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('LABOR', 'PART', 'OTHER') NOT NULL,
  part_id BIGINT UNSIGNED NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quotation_items_quotation FOREIGN KEY (quotation_id) REFERENCES quotations (id),
  CONSTRAINT fk_quotation_items_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT chk_quotation_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_quotation_items_amounts CHECK (unit_price >= 0 AND line_total >= 0),
  INDEX idx_quotation_items_quotation_id (quotation_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE part_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'PENDING',
    'APPROVED',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'REJECTED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING',
  note TEXT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_part_requests_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_part_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
  CONSTRAINT fk_part_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users (id),
  INDEX idx_part_requests_status_created (status, created_at),
  INDEX idx_part_requests_ticket_id (ticket_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE part_request_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  part_request_id BIGINT UNSIGNED NOT NULL,
  part_id BIGINT UNSIGNED NOT NULL,
  requested_quantity INT NOT NULL,
  fulfilled_quantity INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_part_request_items_request FOREIGN KEY (part_request_id) REFERENCES part_requests (id),
  CONSTRAINT fk_part_request_items_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT chk_part_request_items_requested CHECK (requested_quantity > 0),
  CONSTRAINT chk_part_request_items_fulfilled CHECK (
    fulfilled_quantity >= 0 AND fulfilled_quantity <= requested_quantity
  ),
  UNIQUE KEY uk_part_request_items (part_request_id, part_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE inventory_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  part_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NULL,
  transaction_type ENUM(
    'STOCK_IN',
    'STOCK_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RETURN'
  ) NOT NULL,
  quantity INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id BIGINT UNSIGNED NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_transactions_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT fk_inventory_transactions_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_inventory_transactions_user FOREIGN KEY (performed_by) REFERENCES users (id),
  CONSTRAINT chk_inventory_transactions_quantity CHECK (quantity > 0),
  CONSTRAINT chk_inventory_transactions_balances CHECK (
    quantity_before >= 0 AND quantity_after >= 0
  ),
  INDEX idx_inventory_transactions_part_id (part_id),
  INDEX idx_inventory_transactions_ticket_id (ticket_id),
  INDEX idx_inventory_transactions_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE repair_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  action_description TEXT NOT NULL,
  result TEXT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_logs_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_repair_logs_technician FOREIGN KEY (technician_id) REFERENCES users (id),
  CONSTRAINT chk_repair_logs_time CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  ),
  INDEX idx_repair_logs_ticket_id (ticket_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE repair_log_parts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_log_id BIGINT UNSIGNED NOT NULL,
  part_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_log_parts_log FOREIGN KEY (repair_log_id) REFERENCES repair_logs (id),
  CONSTRAINT fk_repair_log_parts_part FOREIGN KEY (part_id) REFERENCES parts (id),
  CONSTRAINT chk_repair_log_parts_quantity CHECK (quantity > 0),
  UNIQUE KEY uk_repair_log_parts (repair_log_id, part_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE test_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  tested_by BIGINT UNSIGNED NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  result ENUM('PASS', 'FAIL') NOT NULL,
  note TEXT NULL,
  tested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_test_results_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_test_results_user FOREIGN KEY (tested_by) REFERENCES users (id),
  INDEX idx_test_results_ticket_id (ticket_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_code VARCHAR(30) NOT NULL UNIQUE,
  ticket_id BIGINT UNSIGNED NOT NULL UNIQUE,
  subtotal DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_status ENUM(
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
  ) NOT NULL DEFAULT 'UNPAID',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT chk_invoices_amounts CHECK (
    subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0
    AND total_amount >= 0 AND paid_amount >= 0
  ),
  CONSTRAINT chk_invoices_paid_amount CHECK (paid_amount <= total_amount),
  INDEX idx_invoices_payment_status (payment_status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_code VARCHAR(30) NOT NULL UNIQUE,
  invoice_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'E_WALLET') NOT NULL,
  status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'COMPLETED',
  transaction_reference VARCHAR(191) NULL,
  received_by BIGINT UNSIGNED NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
  CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users (id),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  INDEX idx_payments_invoice_id (invoice_id),
  INDEX idx_payments_paid_at (paid_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL UNIQUE,
  delivered_by BIGINT UNSIGNED NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  recipient_phone VARCHAR(20) NULL,
  proof_url VARCHAR(500) NULL,
  note TEXT NULL,
  delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deliveries_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_deliveries_delivered_by FOREIGN KEY (delivered_by) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  technician_rating TINYINT UNSIGNED NULL,
  service_rating TINYINT UNSIGNED NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_ticket FOREIGN KEY (ticket_id) REFERENCES repair_tickets (id),
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES users (id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_reviews_technician_rating CHECK (
    technician_rating IS NULL OR technician_rating BETWEEN 1 AND 5
  ),
  CONSTRAINT chk_reviews_service_rating CHECK (
    service_rating IS NULL OR service_rating BETWEEN 1 AND 5
  ),
  INDEX idx_reviews_customer_id (customer_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id BIGINT UNSIGNED NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_notifications_user_read (user_id, is_read),
  INDEX idx_notifications_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NULL,
  old_data JSON NULL,
  new_data JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_audit_logs_entity (entity_type, entity_id),
  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
