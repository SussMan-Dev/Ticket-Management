ALTER TABLE part_request_items
  ADD COLUMN unit_price DECIMAL(12, 2) NULL
    AFTER fulfilled_quantity;

UPDATE part_request_items AS pri
INNER JOIN parts AS p ON p.id = pri.part_id
SET pri.unit_price = p.selling_price
WHERE pri.unit_price IS NULL;

ALTER TABLE part_request_items
  MODIFY COLUMN unit_price DECIMAL(12, 2) NOT NULL,
  ADD CONSTRAINT chk_part_request_items_unit_price CHECK (unit_price >= 0);
