ALTER TABLE users
  ADD COLUMN failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0
    AFTER last_login_at,
  ADD COLUMN locked_until DATETIME NULL
    AFTER failed_login_attempts,
  ADD INDEX idx_users_locked_until (locked_until);
