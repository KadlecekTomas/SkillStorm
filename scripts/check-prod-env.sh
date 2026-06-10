#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${1:-docker-compose.prod.yml}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

fail() {
  echo "Production env guard failed: $1" >&2
  exit 1
}

if grep -nE ':-[^}]*(secret|supersecret|changeme|change_me|password|postgres|dev|test|default)' "$COMPOSE_FILE" >/dev/null; then
  fail "compose file contains a fallback value that looks like a secret/default"
fi

if grep -nE 'JWT_SECRET|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET|POSTGRES_PASSWORD|DATABASE_URL|METRICS_INGEST_KEY' "$COMPOSE_FILE" \
  | grep -vE '\:\?' >/dev/null; then
  fail "sensitive production variables must be required with \${VAR:?message}"
fi

CONFIG_OUTPUT="$(docker compose -f "$COMPOSE_FILE" config 2>&1)" || {
  printf '%s\n' "$CONFIG_OUTPUT" >&2
  exit 1
}

printf '%s\n' "$CONFIG_OUTPUT" | grep -q 'DISABLE_CSRF: "1"' && fail "DISABLE_CSRF=1 is not allowed"
printf '%s\n' "$CONFIG_OUTPUT" | grep -q 'ENABLE_SWAGGER: "1"' && fail "ENABLE_SWAGGER=1 is not allowed by default"
printf '%s\n' "$CONFIG_OUTPUT" | grep -qiE 'supersecret|changeme|change_me|dev-secret' && fail "rendered config contains weak/default secret markers"
printf '%s\n' "$CONFIG_OUTPUT" | grep -qE 'API_PROXY_TARGET: .+' || fail "frontend API_PROXY_TARGET must be set"

if printf '%s\n' "$CONFIG_OUTPUT" | awk '
  /^  postgres:/ { in_service=1; next }
  /^  [a-zA-Z0-9_-]+:/ { in_service=0 }
  in_service && /^    ports:/ { found=1 }
  END { exit found ? 0 : 1 }
'; then
  fail "postgres service must not publish ports in production"
fi

if printf '%s\n' "$CONFIG_OUTPUT" | awk '
  /^  redis:/ { in_service=1; next }
  /^  [a-zA-Z0-9_-]+:/ { in_service=0 }
  in_service && /^    ports:/ { found=1 }
  END { exit found ? 0 : 1 }
'; then
  fail "redis service must not publish ports in production"
fi

printf '%s\n' "$CONFIG_OUTPUT" | grep -q 'NODE_ENV: production' || fail "production services must set NODE_ENV=production"

echo "Production env guard passed."
