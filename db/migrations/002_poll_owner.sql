-- ============================================================================
-- Migration 002 - record who created each poll (needed for profiles/search).
--
-- Run AFTER 001_users.sql, on an EXISTING database:
--
--   docker compose exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < db/migrations/002_poll_owner.sql
--
-- Run it ONCE (MySQL has no "ADD COLUMN IF NOT EXISTS"). Existing polls keep
-- created_by = NULL, which the app shows as having no owner.
-- ============================================================================

SET NAMES utf8mb4;

ALTER TABLE polls
  ADD COLUMN created_by INT UNSIGNED NULL AFTER is_active,
  ADD KEY idx_polls_created_by (created_by),
  ADD CONSTRAINT fk_polls_user
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
