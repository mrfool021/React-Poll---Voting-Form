-- ============================================================================
-- Migration 005 - comment threads on polls.
--
--   * parent_id NULL      -> top-level comment
--   * parent_id NOT NULL  -> reply (the API keeps threads one level deep)
--   * The composite FK (parent_id, poll_id) -> (id, poll_id) guarantees a reply
--     always lives in the SAME poll as its parent (same trick as votes/options).
--   * Deleting a user or poll cascades; deleting a comment removes its replies.
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id     INT UNSIGNED    NOT NULL,
  user_id     INT UNSIGNED    NOT NULL,
  parent_id   BIGINT UNSIGNED NULL,
  body        VARCHAR(500)    NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_comments_id_poll (id, poll_id),
  KEY idx_comments_poll_parent (poll_id, parent_id, id),
  KEY idx_comments_parent (parent_id),
  KEY idx_comments_user (user_id),
  CONSTRAINT fk_comments_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent
    FOREIGN KEY (parent_id, poll_id) REFERENCES comments (id, poll_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
