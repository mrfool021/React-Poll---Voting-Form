#!/usr/bin/env bash
# Dumps the database to ./backups/pollsdb-<timestamp>.sql.gz (images included).
# Works with the same COMPOSE_FILE variable as migrate.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
out="backups/pollsdb-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines --hex-blob "$MYSQL_DATABASE"' | gzip > "$out"
echo "Backup written to $out"
