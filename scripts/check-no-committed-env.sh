#!/usr/bin/env sh
set -eu

blocked="$(git ls-files | awk '
  $0 == ".env" ||
  $0 == ".env.local" ||
  $0 == ".env.production" ||
  $0 == ".env.test" ||
  $0 == ".env.development" ||
  $0 == ".env.staging" ||
  $0 == "server/.env" ||
  $0 == "server/.env.local" ||
  $0 == "server/.env.production" ||
  $0 == "server/.env.test" ||
  $0 == "server/.env.development" ||
  $0 == "server/.env.staging" ||
  $0 == "client/.env" ||
  $0 == "client/.env.local" ||
  $0 == "client/.env.production" ||
  $0 == "client/.env.test" ||
  $0 == "client/.env.development" ||
  $0 == "client/.env.staging" ||
  $0 ~ /(^|\/)\.env\..*\.local$/ {
    print
  }
')"

if [ -n "$blocked" ]; then
  echo "Blocked committed env files:" >&2
  printf '%s\n' "$blocked" >&2
  exit 1
fi

echo "No blocked env files are tracked."
