#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COOKIE_JAR="$(mktemp)"
TMP_DIR="$(mktemp -d)"
trap 'rm -f "$COOKIE_JAR"; rm -rf "$TMP_DIR"' EXIT

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:4200}"
STUDENT_EMAIL="${DEMO_STUDENT_EMAIL:-student-d@zs.demo.local}"
STUDENT_PASSWORD="${DEMO_STUDENT_PASSWORD:-Password123!}"

wait_for_health() {
  local service="$1"
  local cid
  cid="$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q "$service")"
  if [[ -z "$cid" ]]; then
    echo "Service $service is not running" >&2
    exit 1
  fi

  local status=""
  for _ in $(seq 1 90); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
    if [[ "$status" == "healthy" ]]; then
      echo "$service is healthy"
      return
    fi
    sleep 2
  done

  echo "Service $service did not become healthy (last status: $status)" >&2
  exit 1
}

extract_csrf() {
  awk '$6 == "ss_csrf" { print $7 }' "$COOKIE_JAR" | tail -n 1
}

json_get() {
  local file="$1"
  local expr="$2"
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const value = (${expr});
    if (value === undefined || value === null || value === '') process.exit(2);
    process.stdout.write(String(value));
  " "$file"
}

cd "$ROOT_DIR"

export DEMO_MODE=1
export DEMO_SEED=0
export METRICS_INGEST_KEY="${METRICS_INGEST_KEY:-demo-metrics-key}"
export JWT_SECRET="${JWT_SECRET:-demo-jwt-secret}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"
export API_URL="${API_URL:-http://localhost:4200}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://frontend:3000}"

docker compose --profile dev up -d
wait_for_health backend
wait_for_health frontend

curl --fail --silent --show-error "$BACKEND_URL/health" >/dev/null
echo "Backend /health OK"

docker compose exec -T backend sh -lc 'DEMO_SEED=1 npm run db:seed'
echo "Demo seed profile applied"

curl --fail --silent --show-error \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"password\":\"$STUDENT_PASSWORD\"}" \
  "$FRONTEND_URL/api/auth/login" \
  > "$TMP_DIR/login.json"

for cookie_name in ss_at ss_rt ss_csrf; do
  if ! awk -v name="$cookie_name" '$6 == name { found=1 } END { exit(found ? 0 : 1) }' "$COOKIE_JAR"; then
    echo "Missing cookie $cookie_name after login" >&2
    exit 1
  fi
done
echo "Login set auth cookies"

curl --fail --silent --show-error \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  "$FRONTEND_URL/api/auth/me" \
  > "$TMP_DIR/me.json"
echo "Cookie auth works on /auth/me"

curl --fail --silent --show-error \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  "$FRONTEND_URL/api/assignments/my" \
  > "$TMP_DIR/assignments.json"

assignment_id="$(json_get "$TMP_DIR/assignments.json" "data?.data?.[0]?.id ?? data?.[0]?.id")"
if [[ -z "$assignment_id" ]]; then
  echo "Student assignment list returned no assignment" >&2
  exit 1
fi
echo "Student assignment list accessible: $assignment_id"

csrf_token="$(extract_csrf)"
if [[ -z "$csrf_token" ]]; then
  echo "Missing CSRF token" >&2
  exit 1
fi

curl --fail --silent --show-error \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -H "x-csrf-token: $csrf_token" \
  -d "{\"assignmentId\":\"$assignment_id\"}" \
  "$FRONTEND_URL/api/submissions" \
  > "$TMP_DIR/submission.json"

submission_id="$(json_get "$TMP_DIR/submission.json" "data?.data?.id ?? data?.id")"
submission_status="$(json_get "$TMP_DIR/submission.json" "data?.data?.status ?? data?.status")"
if [[ "$submission_status" != "PENDING" ]]; then
  echo "Unexpected submission status: $submission_status" >&2
  exit 1
fi

echo "Submission created successfully: $submission_id"
echo "Demo smoke passed"
