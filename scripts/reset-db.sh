#!/usr/bin/env bash
set -euo pipefail

# CNC Machinery - Reset database script
# Drops and recreates the database, then re-runs all migrations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}')" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "WARNING: This will DROP and recreate the database."
read -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

docker compose exec db psql -U postgres -c "DROP DATABASE IF EXISTS cnc_machinery;"
docker compose exec db psql -U postgres -c "CREATE DATABASE cnc_machinery;"

echo "Database reset. Running migrations..."
bash "$SCRIPT_DIR/migrate.sh"

echo "Done."
