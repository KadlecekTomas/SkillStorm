#!/usr/bin/env node
'use strict';

/**
 * Preflight for `start:e2e` (the backend instance Playwright tests run
 * against): refuses to boot unless DATABASE_URL points at a `_test` database.
 * E2E suites mutate data heavily, so the server under test must never be
 * pointed at a dev/prod database.
 */
const { assertTestDatabaseUrl, redactDatabaseUrl } = require('./db-safety');

try {
  assertTestDatabaseUrl(process.env.DATABASE_URL, 'start:e2e preflight');
  console.log(`[assert-test-db] OK: ${redactDatabaseUrl(process.env.DATABASE_URL)}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
