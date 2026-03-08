#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

wait_for_health() {
  local service="$1"
  local cid
  cid="$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q "$service")"
  if [[ -z "$cid" ]]; then
    echo "Service $service is not running" >&2
    exit 1
  fi

  local status=""
  for _ in $(seq 1 60); do
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

cd "$ROOT_DIR"

docker compose up -d
wait_for_health backend
wait_for_health frontend

if docker compose run --rm -T \
  --entrypoint sh \
  -e NODE_ENV=production \
  -e PUBLIC_APP_URL=https://app.example.com \
  -e API_URL=https://api.other-site.net \
  -e ALLOW_CROSS_SITE_COOKIES=0 \
  backend \
  -lc "node -e \"require('./dist/bootstrap.utils').validateEnvironment()\"" >/tmp/skillstorm-cross-site-block.log 2>&1; then
  echo "Backend accepted unsafe cross-site cookie topology without override" >&2
  exit 1
fi

docker compose run --rm -T \
  --entrypoint sh \
  -e NODE_ENV=production \
  -e PUBLIC_APP_URL=https://app.example.com \
  -e API_URL=https://api.other-site.net \
  -e ALLOW_CROSS_SITE_COOKIES=1 \
  backend \
  -lc "node -e \"require('./dist/bootstrap.utils').validateEnvironment()\""

echo "Cross-site cookie topology is blocked unless explicit override is set"

curl --fail --silent --show-error http://localhost:4200/health >/dev/null
echo "Backend /health OK"

telemetry_flag="$(docker compose exec -T frontend printenv ENABLE_RBAC_TELEMETRY_CLIENT || true)"
if [[ -n "${telemetry_flag:-}" && "$telemetry_flag" != "0" ]]; then
  echo "Client RBAC telemetry is enabled by default in production" >&2
  exit 1
fi
echo "Client RBAC telemetry is disabled by default"

if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  curl --fail --silent --show-error \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
    http://localhost:3000/api/auth/login >/dev/null

  curl --fail --silent --show-error \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    http://localhost:3000/api/auth/me >/dev/null

  csrf_token="$(extract_csrf)"
  if [[ -z "$csrf_token" ]]; then
    echo "Missing ss_csrf cookie after login" >&2
    exit 1
  fi

  curl --silent --show-error \
    -o /tmp/skillstorm-metrics-response.json \
    -w '%{http_code}' \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -H "x-csrf-token: $csrf_token" \
    -d '{"route":"/app/tests","permissionKey":"VIEW_RESULTS","message":"smoke"}' \
    http://localhost:3000/api/metrics/rbac | tee /tmp/skillstorm-metrics-status.txt >/dev/null

  echo "Cookie auth flow OK"
else
  echo "Skipping login smoke: set SMOKE_EMAIL and SMOKE_PASSWORD to verify cookie auth."
fi

metrics_status="$(curl --silent --show-error \
  -o /tmp/skillstorm-metrics-public.json \
  -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"route":"/app/tests","permissionKey":"VIEW_RESULTS","message":"unauthenticated"}' \
  http://localhost:3000/api/metrics/rbac)"

if [[ "$metrics_status" != "401" && "$metrics_status" != "403" ]]; then
  echo "Expected unauthenticated metrics route to reject request, got $metrics_status" >&2
  exit 1
fi

if [[ -n "${METRICS_INGEST_KEY:-}" ]] && grep -q "$METRICS_INGEST_KEY" /tmp/skillstorm-metrics-public.json; then
  echo "Metrics route leaked ingest key" >&2
  exit 1
fi

echo "Metrics route rejects unauthenticated traffic without leaking secrets"

if [[ -n "${SMOKE_FORBIDDEN_EMAIL:-}" && -n "${SMOKE_FORBIDDEN_PASSWORD:-}" && -n "${SMOKE_FORBIDDEN_PATH:-}" ]]; then
  before_count="$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-skillstorm}" -tAc "SELECT count(*) FROM audit_logs WHERE action = 'FORBIDDEN_ACCESS';" | tr -d '[:space:]')"

  curl --fail --silent --show-error \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_FORBIDDEN_EMAIL\",\"password\":\"$SMOKE_FORBIDDEN_PASSWORD\"}" \
    http://localhost:3000/api/auth/login >/dev/null

  forbidden_status="$(curl --silent --show-error \
    -o /tmp/skillstorm-forbidden-response.json \
    -w '%{http_code}' \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    "http://localhost:3000${SMOKE_FORBIDDEN_PATH}")"

  if [[ "$forbidden_status" != "403" ]]; then
    echo "Expected forbidden smoke request to return 403, got $forbidden_status" >&2
    exit 1
  fi

  after_count="$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-skillstorm}" -tAc "SELECT count(*) FROM audit_logs WHERE action = 'FORBIDDEN_ACCESS';" | tr -d '[:space:]')"

  if [[ "${after_count:-0}" -le "${before_count:-0}" ]]; then
    echo "Server-side RBAC telemetry did not record the forbidden event" >&2
    exit 1
  fi

  echo "Server-side RBAC telemetry recorded forbidden access"
else
  echo "Skipping server-side RBAC telemetry smoke: set SMOKE_FORBIDDEN_EMAIL, SMOKE_FORBIDDEN_PASSWORD, and SMOKE_FORBIDDEN_PATH."
fi
