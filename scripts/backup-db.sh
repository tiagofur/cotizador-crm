#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# backup-db.sh — Snapshots the SQLite database from the running container
# Usage: ./scripts/backup-db.sh [output_dir]
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="nahu-cocinas"
DB_PATH="/app/db/custom.db"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/custom_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '${CONTAINER}' is not running."
  echo "   Start it with: docker compose up -d app"
  exit 1
fi

echo "📦 Snapshotting database from container..."

# Use SQLite's backup API via .backup command for a consistent snapshot
# (safe even while the app is writing to the DB)
docker exec "$CONTAINER" \
  sqlite3 "$DB_PATH" ".backup '/tmp/backup.db'" 2>/dev/null \
  || docker cp "${CONTAINER}:${DB_PATH}" "$BACKUP_FILE"

# If sqlite3 wasn't available in the container, fall back to direct copy
if [ ! -f "$BACKUP_FILE" ]; then
  docker cp "${CONTAINER}:${DB_PATH}" "$BACKUP_FILE"
fi

# Clean up temp file inside container
docker exec "$CONTAINER" rm -f /tmp/backup.db 2>/dev/null || true

# Verify the backup
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  TABLES=$(sqlite3 "$BACKUP_FILE" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")
  echo "✅ Backup created: ${BACKUP_FILE}"
  echo "   Size: ${SIZE} | Tables: ${TABLES}"
else
  echo "❌ Backup failed."
  exit 1
fi

# Keep only the last 10 backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/custom_*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  ls -1t "${BACKUP_DIR}"/custom_*.db | tail -n +11 | xargs rm -f
  echo "🗂  Cleaned old backups (kept last 10)"
fi
