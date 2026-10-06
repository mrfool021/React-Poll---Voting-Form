-- ============================================================================
-- Migration 001 - add the users table to an EXISTING database.
--
-- init.sql only runs on an empty volume, so if you already have data you want
-- to keep, apply this file instead of wiping the volume:
--
--   docker compose exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < db/migrations/001_users.sql
--
-- Safe to run more than once (IF NOT EXISTS).
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(30)  NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
