#!/usr/bin/env bash
# SkillStorm database restore.
#
# Restores a pg_dump custom-format backup (made by scripts/ops/backup-db.sh)
# into a target database. Verifies the SHA-256 checksum first when present.
#
# Usage:
#   scripts/ops/restore-db.sh --file backups/daily/skillstorm_20260713_020000.dump \
#     --target-db skillstorm_restore_test [--recreate]
#
# Connection (admin) settings via standard libpq env vars:
#   PGHOST (default localhost), PGPORT (default 5432),
#   PGUSER (default postgres), PGPASSWORD
#
# Safety:
#   - A target DB whose name ends with "_test" restores without questions.
#   - Any OTHER target (e.g. the real production DB during disaster
#     recovery) requires interactively re-typing the exact database name.
#     Non-interactive shells are refused. There is no flag to skip this.
#
# Full runbook: docs/ops/backup-restore.md
set -euo pipefail

FILE=""
TARGET_DB=""
RECREATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --target-db) TARGET_DB="$2"; shift 2 ;;
    --recreate) RECREATE=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$FILE" && -n "$TARGET_DB" ]] || { echo "ERROR: --file and --target-db are required. See --help." >&2; exit 2; }
[[ -f "$FILE" ]] || { echo "ERROR: backup file not found: $FILE" >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "ERROR: pg_restore not found in PATH." >&2; exit 1; }

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

# --- safety confirmation ---------------------------------------------------
if [[ "$TARGET_DB" != *_test ]]; then
  echo "!! Target database '$TARGET_DB' is NOT a *_test database."
  echo "!! This will OVERWRITE its contents with the backup: $FILE"
  if [[ ! -t 0 ]]; then
    echo "ERROR: non-interactive shell — refusing to restore into a non-test database." >&2
    exit 1
  fi
  printf 'Type the exact database name to confirm: '
  read -r confirmation
  if [[ "$confirmation" != "$TARGET_DB" ]]; then
    echo "ERROR: confirmation mismatch — aborting." >&2
    exit 1
  fi
fi

# --- checksum verification -------------------------------------------------
if [[ -f "$FILE.sha256" ]]; then
  echo "[restore-db] verifying checksum..."
  ( cd "$(dirname "$FILE")" && shasum -a 256 -c "$(basename "$FILE").sha256" )
else
  echo "[restore-db] WARNING: no .sha256 next to the backup — skipping integrity check."
fi

# --- (re)create target -----------------------------------------------------
exists="$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'" || true)"
if [[ "$exists" == "1" && "$RECREATE" == "1" ]]; then
  echo "[restore-db] dropping existing database '$TARGET_DB' (--recreate)"
  psql -d postgres -qc "DROP DATABASE \"$TARGET_DB\" WITH (FORCE)"
  exists=""
fi
if [[ "$exists" != "1" ]]; then
  echo "[restore-db] creating database '$TARGET_DB'"
  psql -d postgres -qc "CREATE DATABASE \"$TARGET_DB\""
fi

# --- restore ----------------------------------------------------------------
echo "[restore-db] restoring $FILE -> $TARGET_DB"
# --clean --if-exists: idempotent into a non-empty DB; --no-owner/--no-acl
# matches how the backup was taken. Single transaction => all-or-nothing.
pg_restore --dbname="$TARGET_DB" --clean --if-exists --no-owner --no-acl \
  --single-transaction --exit-on-error "$FILE"

tables="$(psql -d "$TARGET_DB" -tAc "SELECT count(*) FROM pg_stat_user_tables")"
echo "[restore-db] done: database '$TARGET_DB' now has $tables user tables."
echo "[restore-db] NEXT: verify the app against it — see docs/ops/backup-restore.md (smoke test section)."
