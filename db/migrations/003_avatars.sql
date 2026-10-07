-- ============================================================================
-- Migration 003 - user avatars.
--
--   * users.avatar_url      : optional external https:// avatar (URL mode)
--   * user_avatars          : uploaded avatar bytes (upload mode), one row per user
--
-- Re-runnable: the ALTER is guarded by an information_schema check.
-- ============================================================================
SET NAMES utf8mb4;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER password_hash',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Images live in their own table so ordinary user queries never drag blobs
-- around. `etag` changes on every write and is used as a cache-busting ?v= value.
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id     INT UNSIGNED NOT NULL,
  mime        VARCHAR(20)  NOT NULL,
  data        MEDIUMBLOB   NOT NULL,
  etag        CHAR(16)     NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_avatars_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_user_avatars_mime
    CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
