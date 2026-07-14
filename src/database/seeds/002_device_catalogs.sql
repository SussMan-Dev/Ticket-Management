INSERT INTO device_categories (name, description)
VALUES
  ('Desktop', 'Desktop computers and workstations.'),
  ('Game Console', 'Home and handheld game consoles.'),
  ('Laptop', 'Portable computers and notebooks.'),
  ('Monitor', 'Computer monitors and external displays.'),
  ('Other', 'Electronic devices outside the standard categories.'),
  ('Smartphone', 'Mobile phones and smartphones.'),
  ('Tablet', 'Tablet computers and e-readers.'),
  ('Television', 'Televisions and smart TVs.')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

INSERT INTO device_brands (name)
VALUES
  ('Acer'),
  ('Apple'),
  ('ASUS'),
  ('Dell'),
  ('HP'),
  ('Lenovo'),
  ('LG'),
  ('Microsoft'),
  ('Nintendo'),
  ('Other'),
  ('Samsung'),
  ('Sony'),
  ('Xiaomi')
ON DUPLICATE KEY UPDATE
  name = VALUES(name);
