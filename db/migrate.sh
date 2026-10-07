#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Applies every db/migrations/*.sql that has not been applied yet, in order.
# Applied versions are recorded in the schema_migrations table.
#
#   ./db/migrate.sh                      # dev (uses docker-compose.yml + override)
#   COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml ./db/migrate.sh   # production
#
# Existing databases that were created BEFORE this script existed are detected
# automatically (001 / 002 are marked as applied when their objects exist).
# Take a backup first:  ./db/backup.sh
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

DC="docker compose"
mysql_exec() { $DC exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -N -B -u root "$MYSQL_DATABASE"' "$@"; }
sql()  { echo "$1" | mysql_exec; }

echo "Waiting for the database..."
for _ in $(seq 1 30); do
  if sql "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 2
done

sql "CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(100) NOT NULL PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

# Adopt a pre-tracking database: mark 001/002 as done if their objects exist.
tracked=$(sql "SELECT COUNT(*) FROM schema_migrations")
if [ "$tracked" = "0" ]; then
  has_users=$(sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'")
  has_owner=$(sql "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='polls' AND COLUMN_NAME='created_by'")
  [ "$has_users" != "0" ] && sql "INSERT IGNORE INTO schema_migrations (version) VALUES ('001_users')" && echo "Adopted 001_users"
  [ "$has_owner" != "0" ] && sql "INSERT IGNORE INTO schema_migrations (version) VALUES ('002_poll_owner')" && echo "Adopted 002_poll_owner"
fi

applied=0
for file in db/migrations/*.sql; do
  version=$(basename "$file" .sql)
  done_already=$(sql "SELECT COUNT(*) FROM schema_migrations WHERE version='${version}'")
  if [ "$done_already" != "0" ]; then
    echo "skip   $version"
    continue
  fi
  echo "apply  $version"
  $DC exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root "$MYSQL_DATABASE"' < "$file"
  sql "INSERT INTO schema_migrations (version) VALUES ('${version}')"
  applied=$((applied + 1))
done
echo "Done. ${applied} migration(s) applied."
