-- ============================================================================
-- Migration 006 - social graph (followers / following).
--
-- One row = "follower_id follows following_id".
--   * PRIMARY KEY (follower_id, following_id) makes a duplicate follow impossible
--     and serves "who does X follow?" and the is-following check.
--   * KEY (following_id, created_at) serves "who follows X?" and follower counts.
--   * Self-follows are rejected by the API (400). A CHECK (follower_id <>
--     following_id) is NOT used: MySQL forbids CHECK constraints on columns that
--     have foreign keys with referential actions (error 3823).
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS follows (
  follower_id   INT UNSIGNED NOT NULL,
  following_id  INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  KEY idx_follows_following (following_id, created_at),
  CONSTRAINT fk_follows_follower
    FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_following
    FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
