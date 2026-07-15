ALTER TABLE repair_tickets
  ADD COLUMN repair_address VARCHAR(500) NULL
    AFTER customer_issue;
