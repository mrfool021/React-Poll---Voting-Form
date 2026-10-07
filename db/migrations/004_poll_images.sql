-- ============================================================================
-- Migration 004 - images attached to polls.
--
-- "A photo can never be posted standalone" is enforced in three layers:
--   1. API   : there is NO image-upload endpoint. The image is a field of
--              POST /api/polls and the whole request (question + >=2 options +
--              image) is validated, then written in ONE transaction.
--   2. DB    : poll_id is the PRIMARY KEY *and* a foreign key to polls, so an
--              image row cannot exist without its poll, and a poll has at most
--              one image. ON DELETE CASCADE removes the image with the poll.
--   3. API   : there is no endpoint to add/replace an image on an existing poll.
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS poll_images (
  poll_id     INT UNSIGNED NOT NULL,
  mime        VARCHAR(20)  NOT NULL,
  data        MEDIUMBLOB   NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (poll_id),
  CONSTRAINT fk_poll_images_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
  CONSTRAINT chk_poll_images_mime
    CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
