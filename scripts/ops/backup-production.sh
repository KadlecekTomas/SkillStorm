#!/usr/bin/env bash
# SkillStorm production backup orchestration.
#
# Creates the normal local pg_dump via backup-db.sh, uploads the dump and its
# SHA-256 sidecar to S3-compatible storage using curl SigV4, verifies the
# remote object size + checksum sidecar, and records a non-secret freshness
# marker consumed by check-backup-freshness.sh.
#
# Required environment:
#   DATABASE_URL
#   BACKUP_S3_ENDPOINT          e.g. https://<account>.r2.cloudflarestorage.com
#   BACKUP_S3_BUCKET            bucket name
#   BACKUP_S3_REGION            signing region (R2: auto, AWS: real region)
#   BACKUP_S3_ACCESS_KEY_ID
#   BACKUP_S3_SECRET_ACCESS_KEY
#   BACKUP_ALERT_WEBHOOK_URL    generic JSON webhook for failures
#
# Optional:
#   BACKUP_DIR                  local retention root (default /backups)
#   BACKUP_S3_PREFIX            remote prefix (default skillstorm/production)
#   BACKUP_STATUS_FILE          freshness marker path
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-skillstorm/production}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-$BACKUP_DIR/status/last-success.env}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: $name is required." >&2
    return 1
  fi
}

for name in \
  DATABASE_URL \
  BACKUP_S3_ENDPOINT \
  BACKUP_S3_BUCKET \
  BACKUP_S3_REGION \
  BACKUP_S3_ACCESS_KEY_ID \
  BACKUP_S3_SECRET_ACCESS_KEY \
  BACKUP_ALERT_WEBHOOK_URL; do
  require_env "$name"
done

command -v curl >/dev/null || { echo "ERROR: curl not found." >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found." >&2; exit 1; }
if ! curl --help all 2>/dev/null | grep -q -- '--aws-sigv4'; then
  echo "ERROR: curl lacks --aws-sigv4 support." >&2
  exit 1
fi

if [[ ! "$BACKUP_S3_BUCKET" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "ERROR: BACKUP_S3_BUCKET contains unsupported characters." >&2
  exit 1
fi
if [[ ! "$BACKUP_S3_PREFIX" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "ERROR: BACKUP_S3_PREFIX contains unsupported characters." >&2
  exit 1
fi

BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT%/}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX#/}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX%/}"

TMP_DIR="$(mktemp -d)"
LOCK_DIR="$BACKUP_DIR/.production-backup.lock"
mkdir -p "$BACKUP_DIR" "$(dirname "$BACKUP_STATUS_FILE")"

cleanup() {
  rm -rf "$TMP_DIR"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

send_alert() {
  local message="$1"
  set +e
  local payload
  payload="$(BACKUP_ALERT_MESSAGE="$message" node -e 'process.stdout.write(JSON.stringify({event:"skillstorm_backup_failed",text:process.env.BACKUP_ALERT_MESSAGE}))')"
  curl --fail --silent --show-error \
    --connect-timeout 10 --max-time 20 \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "$BACKUP_ALERT_WEBHOOK_URL" >/dev/null
  set -e
}

on_error() {
  local rc="$1"
  local line="$2"
  trap - ERR
  send_alert "SkillStorm production backup failed (exit=$rc, line=$line, host=${HOSTNAME:-unknown})."
  exit "$rc"
}
trap 'on_error "$?" "$LINENO"' ERR

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: another production backup appears to be running ($LOCK_DIR)." >&2
  exit 1
fi

CURL_CONFIG="$TMP_DIR/s3.curl.conf"
umask 077
cat > "$CURL_CONFIG" <<EOF
aws-sigv4 = "aws:amz:${BACKUP_S3_REGION}:s3"
user = "${BACKUP_S3_ACCESS_KEY_ID}:${BACKUP_S3_SECRET_ACCESS_KEY}"
EOF
chmod 600 "$CURL_CONFIG"

s3_curl() {
  curl --config "$CURL_CONFIG" \
    --fail --silent --show-error \
    --retry 3 --retry-all-errors \
    --connect-timeout 15 --max-time 1800 \
    "$@"
}

remote_url() {
  local key="$1"
  printf '%s/%s/%s' "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_BUCKET" "$key"
}

put_object() {
  local local_file="$1" key="$2"
  s3_curl --request PUT --upload-file "$local_file" "$(remote_url "$key")" >/dev/null
}

verify_remote_pair() {
  local dump="$1" checksum_file="$2" key="$3"
  local local_size remote_size local_sha remote_sha
  local_size="$(stat -c '%s' "$dump")"
  remote_size="$(s3_curl --head "$(remote_url "$key")" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Content-Length:/ {print $2}' | tail -1)"
  if [[ -z "$remote_size" || "$remote_size" != "$local_size" ]]; then
    echo "ERROR: remote dump size verification failed for $key." >&2
    return 1
  fi

  local_sha="$(awk '{print $1}' "$checksum_file")"
  remote_sha="$(s3_curl "$(remote_url "$key.sha256")" | awk '{print $1}')"
  if [[ -z "$local_sha" || "$remote_sha" != "$local_sha" ]]; then
    echo "ERROR: remote checksum sidecar verification failed for $key." >&2
    return 1
  fi
}

START_MARKER="$TMP_DIR/start.marker"
touch "$START_MARKER"

DATABASE_URL="$DATABASE_URL" BACKUP_DIR="$BACKUP_DIR" \
  "$SCRIPT_DIR/backup-db.sh" --backup-dir "$BACKUP_DIR"

mapfile -t new_dumps < <(find "$BACKUP_DIR/daily" -maxdepth 1 -type f -name '*.dump' -newer "$START_MARKER" -print | sort)
if [[ "${#new_dumps[@]}" -ne 1 ]]; then
  echo "ERROR: expected exactly one new daily dump, found ${#new_dumps[@]}." >&2
  exit 1
fi

DUMP="${new_dumps[0]}"
CHECKSUM="$DUMP.sha256"
[[ -f "$CHECKSUM" ]] || { echo "ERROR: checksum sidecar missing for $DUMP." >&2; exit 1; }
(
  cd "$(dirname "$DUMP")"
  shasum -a 256 -c "$(basename "$CHECKSUM")" >/dev/null
)

BASENAME="$(basename "$DUMP")"
DAILY_KEY="$BACKUP_S3_PREFIX/daily/$BASENAME"
put_object "$DUMP" "$DAILY_KEY"
put_object "$CHECKSUM" "$DAILY_KEY.sha256"
verify_remote_pair "$DUMP" "$CHECKSUM" "$DAILY_KEY"

WEEKLY_DUMP="$BACKUP_DIR/weekly/$BASENAME"
if [[ -f "$WEEKLY_DUMP" && -f "$WEEKLY_DUMP.sha256" ]]; then
  WEEKLY_KEY="$BACKUP_S3_PREFIX/weekly/$BASENAME"
  put_object "$WEEKLY_DUMP" "$WEEKLY_KEY"
  put_object "$WEEKLY_DUMP.sha256" "$WEEKLY_KEY.sha256"
  verify_remote_pair "$WEEKLY_DUMP" "$WEEKLY_DUMP.sha256" "$WEEKLY_KEY"
fi

SUCCESS_EPOCH="$(date +%s)"
LOCAL_SHA256="$(awk '{print $1}' "$CHECKSUM")"
STATUS_TMP="$TMP_DIR/last-success.env"
cat > "$STATUS_TMP" <<EOF
SUCCESS_EPOCH=$SUCCESS_EPOCH
DUMP_BASENAME=$BASENAME
REMOTE_DAILY_KEY=$DAILY_KEY
SHA256=$LOCAL_SHA256
EOF
chmod 600 "$STATUS_TMP"
mv "$STATUS_TMP" "$BACKUP_STATUS_FILE"

echo "[backup-production] off-host backup verified: $DAILY_KEY"
echo "[backup-production] freshness marker: $BACKUP_STATUS_FILE"
