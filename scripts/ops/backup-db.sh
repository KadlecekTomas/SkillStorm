#!/usr/bin/env bash
# SkillStorm database backup.
#
# Creates a compressed pg_dump (custom format) with a timestamp, a SHA-256
# checksum, and applies rotation: keep the last 7 daily and the last 4 weekly
# backups. A backup lands in weekly/ (in addition to daily/) when taken on
# Sunday, or when the newest weekly backup is older than 6 days.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/skillstorm \
#     scripts/ops/backup-db.sh [--backup-dir DIR]
#
# Environment:
#   DATABASE_URL   source database (required; backup is read-only, any DB is allowed)
#   BACKUP_DIR     destination root (default: ./backups relative to repo root)
#
# Restore procedure: docs/ops/backup-restore.md
set -euo pipefail

DAILY_KEEP=7
WEEKLY_KEEP=4

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Refusing to guess a backup source." >&2
  exit 1
fi
command -v pg_dump >/dev/null || { echo "ERROR: pg_dump not found in PATH." >&2; exit 1; }

DB_NAME="$(node -e "process.stdout.write(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)))" 2>/dev/null || true)"
if [[ -z "$DB_NAME" ]]; then
  echo "ERROR: could not parse database name from DATABASE_URL." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

FILE="$DAILY_DIR/${DB_NAME}_${TIMESTAMP}.dump"
echo "[backup-db] dumping database '$DB_NAME' -> $FILE"

# Custom format is compressed by default and required by pg_restore.
# --no-owner/--no-acl: restore must not depend on identical roles existing.
pg_dump --format=custom --compress=6 --no-owner --no-acl \
  --dbname="$DATABASE_URL" --file="$FILE"

# Checksum for integrity verification at restore time.
( cd "$DAILY_DIR" && shasum -a 256 "$(basename "$FILE")" > "$(basename "$FILE").sha256" )

SIZE="$(du -h "$FILE" | cut -f1 | tr -d ' ')"
echo "[backup-db] done: $FILE ($SIZE)"

# --- weekly copy ---------------------------------------------------------
# Take a weekly copy on Sundays, or whenever the newest weekly backup for
# this DB is older than 6 days (covers machines that are off on Sundays).
need_weekly=0
if [[ "$(date +%u)" == "7" ]]; then
  need_weekly=1
else
  # Sort by filename (timestamps embedded) — mtime can lie after copies/rsync.
  newest_weekly="$(ls -1 "$WEEKLY_DIR/${DB_NAME}_"*.dump 2>/dev/null | sort -r | head -1 || true)"
  if [[ -z "$newest_weekly" ]]; then
    need_weekly=1
  else
    if [[ -z "$(find "$newest_weekly" -mtime -6 2>/dev/null)" ]]; then
      need_weekly=1
    fi
  fi
fi
if [[ "$need_weekly" == "1" ]]; then
  cp "$FILE" "$WEEKLY_DIR/"
  cp "$FILE.sha256" "$WEEKLY_DIR/"
  echo "[backup-db] weekly copy stored in $WEEKLY_DIR"
fi

# --- rotation ------------------------------------------------------------
prune() {
  local dir="$1" keep="$2"
  local files
  files="$(ls -1 "$dir/${DB_NAME}_"*.dump 2>/dev/null | sort -r || true)"
  local n=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    n=$((n + 1))
    if (( n > keep )); then
      echo "[backup-db] rotation: removing $(basename "$f")"
      rm -f "$f" "$f.sha256"
    fi
  done <<< "$files"
}
prune "$DAILY_DIR" "$DAILY_KEEP"
prune "$WEEKLY_DIR" "$WEEKLY_KEEP"

echo "[backup-db] retention: $(ls -1 "$DAILY_DIR"/*.dump 2>/dev/null | wc -l | tr -d ' ') daily, $(ls -1 "$WEEKLY_DIR"/*.dump 2>/dev/null | wc -l | tr -d ' ') weekly"
