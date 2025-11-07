#!/usr/bin/env bash
set -euo pipefail
trap 'kill $(jobs -p) >/dev/null 2>&1 || true' EXIT

(cd ../server && npm run start:dev >/tmp/skillstorm-server.log 2>&1 &)

npx wait-on -t 120000 http://localhost:4200/health

(cd . && npm run dev >/tmp/skillstorm-client.log 2>&1 &)

npx wait-on -t 120000 http://localhost:3001

npm run test:e2e
