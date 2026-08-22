#!/usr/bin/env bash
# Verify that the last successful SkillStorm production backup is recent and
# still present in independent S3-compatible storage. Any failure emits a
# webhook alert and exits non-zero so the host scheduler can also alarm.
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-$BACKUP_DIR/status/last-success.env}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: $name is required." >&2
    return 1
  fi
}

for name in \
  BACKUP_S3_ENDPOINT \
  BACKUP_S3_BUCKET \
  BACKUP_S3_REGION \
  BACKUP_S3_ACCESS_KEY_ID \
  BACKUP_S3_SECRET_ACCESS_KEY \
  BACKUP_ALERT_WEBHOOK_URL; do
  require_env "$name"
done

if [[ ! "$BACKUP_MAX_AGE_HOURS" =~ ^[0-9]+$ || "$BACKUP_MAX_AGE_HOURS" -lt 1 ]]; then
  echo "ERROR: BACKUP_MAX_AGE_HOURS must be a positive integer." >&2
  exit 1
fi
command -v curl >/dev/null || { echo "ERROR: curl not found." >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found." >&2; exit 1; }
if ! curl --help all 2>/dev/null | grep -q -- '--aws-sigv4'; then
  echo "ERROR: curl lacks --aws-sigv4 support." >&2
  exit 1
fi

BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

send_alert() {
  local message="$1"
  set +e
  local payload
  payload="$(BACKUP_ALERT_MESSAGE="$message" node -e 'process.stdout.write(JSON.stringify({event:"skillstorm_backup_freshness_failed",text:process.env.BACKUP_ALERT_MESSAGE}))')"
  curl --fail --silent --show-error \
    --connect-timeout 10 --max-time 20 \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "$BACKUP_ALERT_WEBHOOK_URL" >/dev/null
  set -e
}

fail() {
  local message="$1"
  echo "ERROR: $message" >&2
  send_alert "$message"
  exit 1
}

[[ -f "$BACKUP_STATUS_FILE" ]] || fail "SkillStorm backup freshness marker is missing on ${HOSTNAME:-unknown}."

status_value() {
  local key="$1"
  awk -F= -v wanted="$key" '$1 == wanted {sub(/^[^=]*=/, ""); print; exit}' "$BACKUP_STATUS_FILE"
}

SUCCESS_EPOCH="$(status_value SUCCESS_EPOCH)"
DUMP_BASENAME="$(status_value DUMP_BASENAME)"
REMOTE_DAILY_KEY="$(status_value REMOTE_DAILY_KEY)"
EXPECTED_SHA="$(status_value SHA256)"

[[ "$SUCCESS_EPOCH" =~ ^[0-9]+$ ]] || fail "SkillStorm backup freshness marker has an invalid SUCCESS_EPOCH."
[[ "$DUMP_BASENAME" =~ ^[A-Za-z0-9._-]+\.dump$ ]] || fail "SkillStorm backup freshness marker has an invalid dump name."
[[ "$REMOTE_DAILY_KEY" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "SkillStorm backup freshness marker has an invalid remote key."
[[ "$EXPECTED_SHA" =~ ^[a-fA-F0-9]{64}$ ]] || fail "SkillStorm backup freshness marker has an invalid SHA-256 value."

NOW_EPOCH="$(date +%s)"
AGE_SECONDS=$((NOW_EPOCH - SUCCESS_EPOCH))
MAX_AGE_SECONDS=$((BACKUP_MAX_AGE_HOURS * 3600))
if (( AGE_SECONDS < 0 )); then
  fail "SkillStorm backup freshness marker is from the future; clock/state integrity is suspect."
fi
if (( AGE_SECONDS > MAX_AGE_SECONDS )); then
  AGE_HOURS=$((AGE_SECONDS / 3600))
  fail "SkillStorm off-host backup is stale (${AGE_HOURS}h old; max ${BACKUP_MAX_AGE_HOURS}h)."
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
    --retry 2 --retry-all-errors \
    --connect-timeout 15 --max-time 120 \
    "$@"
}

remote_url() {
  local key="$1"
  printf '%s/%s/%s' "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_BUCKET" "$key"
}

if ! s3_curl --head "$(remote_url "$REMOTE_DAILY_KEY")" >/dev/null; then
  fail "SkillStorm latest backup is absent or unreadable in off-host storage."
fi

REMOTE_SHA="$(s3_curl "$(remote_url "$REMOTE_DAILY_KEY.sha256")" | awk '{print $1}')" || fail "SkillStorm remote checksum sidecar is unreadable."
if [[ "$REMOTE_SHA" != "$EXPECTED_SHA" ]]; then
  fail "SkillStorm remote backup checksum metadata does not match the last successful backup."
fi

AGE_MINUTES=$((AGE_SECONDS / 60))
echo "[backup-freshness] OK: $DUMP_BASENAME is ${AGE_MINUTES}m old and present off-host."
