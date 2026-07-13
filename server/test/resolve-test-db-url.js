/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { assertTestDatabaseUrl } = require('../scripts/db-safety');

/**
 * Single source of truth for the test database URL.
 *
 * Resolves EXCLUSIVELY from DATABASE_URL_TEST (process env, then .env.test,
 * then the tracked .env.test.example). An ambient DATABASE_URL is never
 * consulted — @prisma/client auto-loads server/.env on require and would
 * otherwise leak the dev URL into test tooling (this is exactly how the dev
 * DB got wiped once). The returned URL is guard-checked: DB name must end
 * with "_test".
 *
 * Returns null when no DATABASE_URL_TEST is configured anywhere.
 */
function resolveTestDatabaseUrl() {
  if (!process.env.DATABASE_URL_TEST) {
    const dotenvPath = path.resolve(__dirname, '..', '.env.test');
    const dotenvExamplePath = path.resolve(__dirname, '..', '.env.test.example');
    const envFile = fs.existsSync(dotenvPath)
      ? dotenvPath
      : fs.existsSync(dotenvExamplePath)
        ? dotenvExamplePath
        : null;
    if (envFile) {
      const parsed = dotenv.parse(fs.readFileSync(envFile));
      // Only DATABASE_URL_TEST may name the test DB; a stray DATABASE_URL in
      // .env.test is intentionally ignored.
      for (const [key, value] of Object.entries(parsed)) {
        if (key !== 'DATABASE_URL' && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  }
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) return null;
  return assertTestDatabaseUrl(testUrl, 'resolve-test-db-url');
}

module.exports = { resolveTestDatabaseUrl };
