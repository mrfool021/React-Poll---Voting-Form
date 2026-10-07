-- ============================================================================
-- Poll & Voting App - database bootstrap (MySQL 8.4)
--
-- Executed automatically by the official mysql image the FIRST time it starts
-- with an empty data volume (/docker-entrypoint-initdb.d). The database itself
-- is created from MYSQL_DATABASE, so no CREATE DATABASE / USE is needed here.
-- To re-run this script: `docker compose down -v` (this deletes the volume).
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- users: registered accounts (JWT authentication)
--   * password_hash holds a bcrypt hash (60 chars) - plain passwords are never
--     stored. VARCHAR(255) leaves room for a future algorithm change.
--   * username / email are UNIQUE. The default utf8mb4 collation is
--     case-insensitive, so "Ivan" and "ivan" cannot both register.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(30)  NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  avatar_url     VARCHAR(500) NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- polls: one row per question
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  question    VARCHAR(255) NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_polls_active_created (is_active, created_at),
  KEY idx_polls_created_by (created_by),
  CONSTRAINT fk_polls_user
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- options: the answer choices belonging to a poll
--   * UNIQUE (id, poll_id) lets `votes` use a composite foreign key so a vote
--     can never point at an option that belongs to a different poll.
--   * UNIQUE (poll_id, label) prevents duplicate choices inside one poll.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS options (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id   INT UNSIGNED NOT NULL,
  label     VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_options_id_poll (id, poll_id),
  UNIQUE KEY uq_options_poll_label (poll_id, label),
  CONSTRAINT fk_options_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- votes: one row per ballot
--   * voter_hash is a salted SHA-256 of (IP + user agent) - no raw personal
--     data is stored. UNIQUE (poll_id, voter_hash) enforces one vote per voter
--     per poll. NULL hashes (seed data / ENFORCE_ONE_VOTE=false) are allowed
--     many times because MySQL treats NULLs as distinct in unique indexes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id     INT UNSIGNED    NOT NULL,
  option_id   INT UNSIGNED    NOT NULL,
  voter_hash  CHAR(64)        NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_votes_poll_voter (poll_id, voter_hash),
  KEY idx_votes_option_poll (option_id, poll_id),
  CONSTRAINT fk_votes_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
  CONSTRAINT fk_votes_option_poll
    FOREIGN KEY (option_id, poll_id) REFERENCES options (id, poll_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- PlayHub upgrade tables (same definitions as db/migrations/003 - 006)
-- ---------------------------------------------------------------------------
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


-- Tracks which db/migrations/*.sql files are already applied (used by db/migrate.sh).
-- A fresh install already contains everything, so all versions are pre-marked.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(100) NOT NULL,
  applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO schema_migrations (version) VALUES
  ('001_users'), ('002_poll_owner'), ('003_avatars'),
  ('004_poll_images'), ('005_comments'), ('006_follows');

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------
INSERT INTO polls (id, question) VALUES
  (1, 'Which programming language do you enjoy most?'),
  (2, 'What is the best way to learn web development?'),
  (3, 'Which tool do you prefer for orchestrating containers in class projects?');

INSERT INTO options (id, poll_id, label) VALUES
  (1,  1, 'JavaScript'),
  (2,  1, 'Python'),
  (3,  1, 'Java'),
  (4,  1, 'C#'),
  (5,  2, 'Reading documentation'),
  (6,  2, 'Video tutorials'),
  (7,  2, 'Building projects'),
  (8,  2, 'Bootcamps'),
  (9,  3, 'Docker Compose'),
  (10, 3, 'Kubernetes'),
  (11, 3, 'Docker Swarm');

-- Seed ballots (voter_hash NULL = anonymous demo data)
INSERT INTO votes (poll_id, option_id) VALUES
  (1, 1), (1, 1), (1, 1),
  (1, 2), (1, 2), (1, 2), (1, 2),
  (1, 3), (1, 3),
  (1, 4),
  (2, 5), (2, 5),
  (2, 6), (2, 6), (2, 6),
  (2, 7), (2, 7), (2, 7), (2, 7), (2, 7),
  (2, 8),
  (3, 9), (3, 9), (3, 9), (3, 9), (3, 9), (3, 9),
  (3, 10), (3, 10), (3, 10),
  (3, 11);
