#!/usr/bin/env bash
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.prod.yml -f docker-compose.certification.yml)
MANIFEST="client/tests/scenarios/.manifest.json"
EVIDENCE_DIR="client/test-results/backup-restore-certification"
BACKUP="$EVIDENCE_DIR/skillstorm-school.dump"
REPORT="$EVIDENCE_DIR/report.txt"
COOKIE_JAR="$EVIDENCE_DIR/cookies.txt"
LOGIN_JSON="$EVIDENCE_DIR/login.json"
OVERVIEW_JSON="$EVIDENCE_DIR/overview.json"
BASE_URL="${BASE_URL:-https://localhost:3443}"
CURL_TLS_ARGS=()
if [[ "$BASE_URL" == https://* ]]; then
  # Certification Caddy uses an ephemeral internal CA. Keep HTTPS mandatory
  # while ignoring only that CI-only CA-chain trust error.
  CURL_TLS_ARGS+=(--insecure)
fi

mkdir -p "$EVIDENCE_DIR"
: > "$REPORT"
START_EPOCH="$(date +%s)"

log() {
  printf '%s\n' "$*" | tee -a "$REPORT"
}

require_file() {
  if [[ ! -s "$1" ]]; then
    log "ERROR: required file missing or empty: $1"
    exit 1
  fi
}

require_file "$MANIFEST"

ORG_ID="$(node -e "const m=require('./$MANIFEST'); process.stdout.write(m.orgId)")"
ASSIGNMENT_ID="$(node -e "const m=require('./$MANIFEST'); process.stdout.write(m.assignment8AId)")"
STUDENT_EMAIL="$(node -e "const m=require('./$MANIFEST'); process.stdout.write(m.students8A[29])")"
PASSWORD="$(node -e "const m=require('./$MANIFEST'); process.stdout.write(m.password)")"

if [[ -z "$ORG_ID" || -z "$ASSIGNMENT_ID" || -z "$STUDENT_EMAIL" || -z "$PASSWORD" ]]; then
  log "ERROR: scenario manifest is incomplete"
  exit 1
fi

query_db() {
  "${COMPOSE[@]}" exec -T postgres psql \
    -U "$PROD_POSTGRES_USER" \
    -d "$PROD_POSTGRES_DB" \
    -v ON_ERROR_STOP=1 \
    -Atqc "$1"
}

# Content-sensitive fingerprint of the school-critical relational core. Each
# table contributes both a row count and a stable hash of every complete row,
# ordered by primary id. This catches silent value corruption that a count-only
# restore check would miss (for example a changed answer, role, assignment state
# or question payload).
fingerprint_query='SELECT json_build_object(
  '\''organizations'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Organization" t),
  '\''users'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "User" t),
  '\''memberships'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Membership" t),
  '\''classSections'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "ClassSection" t),
  '\''enrollments'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Enrollment" t),
  '\''tests'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Test" t),
  '\''questions'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Question" t),
  '\''assignments'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Assignment" t),
  '\''submissions'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Submission" t),
  '\''responses'\'', (SELECT json_build_object('\''count'\'', count(*), '\''hash'\'', coalesce(md5(string_agg(md5(row_to_json(t)::text), '\'''\'' ORDER BY t.id::text)), md5('\'''\''))) FROM "Response" t)
)::text;'

log "BACKUP_RESTORE_CERTIFICATION_START"
log "transport=https"
log "organization=$ORG_ID"
log "assignment=$ASSIGNMENT_ID"

BEFORE_FINGERPRINT="$(query_db "$fingerprint_query")"
log "before_content_fingerprint=$BEFORE_FINGERPRINT"

ORG_BEFORE="$(query_db "SELECT count(*) FROM \"Organization\" WHERE id = '$ORG_ID';")"
ASSIGNMENT_BEFORE="$(query_db "SELECT count(*) FROM \"Assignment\" WHERE id = '$ASSIGNMENT_ID';")"
if [[ "$ORG_BEFORE" != "1" || "$ASSIGNMENT_BEFORE" != "1" ]]; then
  log "ERROR: critical seeded school records are missing before backup"
  exit 1
fi

log "Creating PostgreSQL custom-format backup..."
"${COMPOSE[@]}" exec -T postgres pg_dump \
  -U "$PROD_POSTGRES_USER" \
  -d "$PROD_POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-privileges > "$BACKUP"
require_file "$BACKUP"
BACKUP_SHA="$(sha256sum "$BACKUP" | awk '{print $1}')"
BACKUP_BYTES="$(wc -c < "$BACKUP" | tr -d ' ')"
log "backup_sha256=$BACKUP_SHA"
log "backup_bytes=$BACKUP_BYTES"

log "Stopping application containers before destructive restore drill..."
"${COMPOSE[@]}" stop frontend backend >/dev/null

log "Destroying disposable certification database..."
"${COMPOSE[@]}" exec -T postgres dropdb \
  -U "$PROD_POSTGRES_USER" \
  --if-exists \
  --force \
  "$PROD_POSTGRES_DB"
"${COMPOSE[@]}" exec -T postgres createdb \
  -U "$PROD_POSTGRES_USER" \
  "$PROD_POSTGRES_DB"

EMPTY_TABLE_COUNT="$(query_db "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
if [[ "$EMPTY_TABLE_COUNT" != "0" ]]; then
  log "ERROR: destructive drill did not produce an empty database (tables=$EMPTY_TABLE_COUNT)"
  exit 1
fi
log "database_destroyed_and_recreated=true"

log "Restoring backup into empty database..."
cat "$BACKUP" | "${COMPOSE[@]}" exec -T postgres pg_restore \
  -U "$PROD_POSTGRES_USER" \
  -d "$PROD_POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  --exit-on-error

AFTER_FINGERPRINT="$(query_db "$fingerprint_query")"
log "after_content_fingerprint=$AFTER_FINGERPRINT"
if [[ "$AFTER_FINGERPRINT" != "$BEFORE_FINGERPRINT" ]]; then
  log "ERROR: school-critical content fingerprint differs after restore"
  exit 1
fi
log "critical_content_fingerprint_restored=true"

ORG_AFTER="$(query_db "SELECT count(*) FROM \"Organization\" WHERE id = '$ORG_ID';")"
ASSIGNMENT_AFTER="$(query_db "SELECT count(*) FROM \"Assignment\" WHERE id = '$ASSIGNMENT_ID';")"
if [[ "$ORG_AFTER" != "1" || "$ASSIGNMENT_AFTER" != "1" ]]; then
  log "ERROR: critical school records are missing after restore"
  exit 1
fi
log "critical_record_identity_restored=true"

log "Restarting exact production application containers..."
"${COMPOSE[@]}" start backend frontend >/dev/null

READY=0
for _ in $(seq 1 60); do
  if curl "${CURL_TLS_ARGS[@]}" --silent --show-error --fail --max-time 3 "$BASE_URL" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [[ "$READY" != "1" ]]; then
  log "ERROR: HTTPS production surface did not recover after restore"
  exit 1
fi
log "production_stack_restarted=true"

LOGIN_BODY="$(node -e "const m=require('./$MANIFEST'); process.stdout.write(JSON.stringify({email:m.students8A[29],password:m.password,organizationId:m.orgId}))")"
LOGIN_STATUS="$(curl "${CURL_TLS_ARGS[@]}" --silent --show-error \
  --output "$LOGIN_JSON" \
  --write-out '%{http_code}' \
  --cookie-jar "$COOKIE_JAR" \
  --header 'Content-Type: application/json' \
  --header 'X-Forwarded-For: 203.0.113.43' \
  --data "$LOGIN_BODY" \
  "$BASE_URL/api/auth/login")"

if [[ "$LOGIN_STATUS" != "200" && "$LOGIN_STATUS" != "201" ]]; then
  log "ERROR: restored HTTPS application login failed status=$LOGIN_STATUS"
  cat "$LOGIN_JSON" | tee -a "$REPORT"
  exit 1
fi
log "restored_secure_login=true"

OVERVIEW_STATUS="$(curl "${CURL_TLS_ARGS[@]}" --silent --show-error \
  --output "$OVERVIEW_JSON" \
  --write-out '%{http_code}' \
  --cookie "$COOKIE_JAR" \
  --header "x-org-id: $ORG_ID" \
  "$BASE_URL/api/assignments/overview")"

if [[ "$OVERVIEW_STATUS" != "200" ]]; then
  log "ERROR: restored assignment overview failed status=$OVERVIEW_STATUS"
  cat "$OVERVIEW_JSON" | tee -a "$REPORT"
  exit 1
fi

node - "$OVERVIEW_JSON" "$ASSIGNMENT_ID" <<'NODE'
const fs = require('node:fs');
const [file, assignmentId] = process.argv.slice(2);
const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
const data = parsed?.data ?? parsed;
const buckets = ['active', 'upcoming', 'closedUnsubmitted', 'completed'];
const found = buckets.some((bucket) =>
  Array.isArray(data?.[bucket]) && data[bucket].some((item) => item.assignmentId === assignmentId),
);
if (!found) {
  console.error(`Restored assignment ${assignmentId} is not visible in student overview`);
  process.exit(1);
}
NODE

END_EPOCH="$(date +%s)"
RTO_SECONDS="$((END_EPOCH - START_EPOCH))"
log "restored_assignment_visible=true"
log "recovery_drill_seconds=$RTO_SECONDS"
log "BACKUP_RESTORE_CERTIFICATION_PASS"
