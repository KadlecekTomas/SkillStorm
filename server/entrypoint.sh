#!/bin/sh
set -e

echo "⏳ Waiting for Postgres..."
until nc -z postgres 5432; do
  sleep 1
done

echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

echo "🚀 Starting backend..."
node dist/main.js
