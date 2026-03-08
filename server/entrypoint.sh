#!/bin/sh
set -e

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-}"

if [ -z "$DB_HOST" ] && [ -n "$DATABASE_URL" ]; then
  DB_HOST="$(node -e "const url = new URL(process.env.DATABASE_URL); process.stdout.write(url.hostname)")"
  DB_PORT="$(node -e "const url = new URL(process.env.DATABASE_URL); process.stdout.write(url.port || '5432')")"
fi

if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
  echo "⏳ Waiting for Postgres at $DB_HOST:$DB_PORT..."
  until nc -z "$DB_HOST" "$DB_PORT"; do
    sleep 1
  done
else
  echo "⏭️ Skipping DB socket wait (DATABASE_URL/DB_HOST not set)"
fi

if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "📦 Running Prisma migrations..."
  npx prisma migrate deploy
else
  echo "⏭️ Skipping Prisma migrations (set RUN_MIGRATIONS=1 to enable)"
fi

if [ "$RUN_SEED" = "1" ]; then
  if [ "$DEMO_SEED" = "1" ]; then
    echo "🎬 Running Prisma demo seed profile..."
    DEMO_SEED=1 npx prisma db seed
  else
    echo "🌱 Running Prisma seed..."
    npx prisma db seed
  fi
else
  echo "⏭️ Skipping Prisma seed (set RUN_SEED=1 to enable)"
fi

echo "🚀 Starting backend..."
node dist/main.js
