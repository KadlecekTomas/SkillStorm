#!/usr/bin/env bash
set -euo pipefail
trap 'kill $(jobs -p) >/dev/null 2>&1 || true' EXIT

# E2E runs ONLY against the dedicated test database (name must end with
# "_test" — enforced by server/scripts/db-safety.js, no bypass). The dev
# DATABASE_URL from server/.env is never used here.
: "${DATABASE_URL_TEST:=postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public}"
export DATABASE_URL_TEST

(cd ../server && DATABASE_URL="$DATABASE_URL_TEST" npm run start:e2e >/tmp/skillstorm-server.log 2>&1 &)

npx wait-on -t 120000 http://localhost:4200/health

(cd . && npm run dev >/tmp/skillstorm-client.log 2>&1 &)

npx wait-on -t 120000 http://localhost:3001

npm run test:e2e
