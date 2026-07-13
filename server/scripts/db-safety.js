'use strict';

/**
 * Hard safety guard for destructive database operations.
 *
 * Contract: any tooling that can destroy data (`prisma migrate reset`,
 * `DROP SCHEMA/DATABASE`, seed scripts that wipe tables) may only ever run
 * against a database whose NAME ends with `_test`.
 *
 * There is intentionally NO environment variable, CLI flag, or option that
 * bypasses this check. If you truly need to run a destructive command
 * against a non-test database (e.g. a deliberate prod restore), you must do
 * it manually with psql/pg_restore — never through the test tooling.
 *
 * Background: on 2026-07 an e2e run wiped the dev database because the test
 * setup inherited a dev DATABASE_URL and ran `prisma migrate reset`. This
 * module is the single choke point that makes that class of accident
 * impossible. Keep it dependency-free CommonJS so every script (jest setup,
 * ts-node seeds, shell preflights, Playwright config) can require it.
 */

/**
 * Explicit whitelist of database names destructive tooling may touch.
 * A bare `_test` suffix is NOT sufficient (it would also admit e.g.
 * "skillstorm_production_test"). Extending this list requires a code
 * change + review — deliberately not configurable via environment.
 */
const ALLOWED_TEST_DB_NAMES = Object.freeze(['skillstorm_test']);

/** Extract the database name from a postgres connection URL. */
function parseDatabaseName(rawUrl) {
  const url = new URL(rawUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) {
    throw new Error(`connection URL has no database name: ${redact(rawUrl)}`);
  }
  return name;
}

/** Redact the password so URLs are safe to print in errors/logs. */
function redact(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '<unparsable database URL>';
  }
}

/**
 * Throws unless `rawUrl` points at a database whose name ends with `_test`.
 * Returns the URL unchanged so it can be used inline.
 */
function assertTestDatabaseUrl(rawUrl, context) {
  const label = context ? ` [${context}]` : '';
  if (!rawUrl) {
    throw new Error(
      `DB SAFETY GUARD${label}: no database URL provided — refusing to run. ` +
        'Destructive test tooling requires an explicit DATABASE_URL_TEST ' +
        'pointing at a database whose name ends with "_test".',
    );
  }
  let dbName;
  try {
    dbName = parseDatabaseName(rawUrl);
  } catch (err) {
    throw new Error(
      `DB SAFETY GUARD${label}: could not parse database URL (${err.message}) — refusing to run.`,
    );
  }
  if (!dbName.endsWith('_test') || !ALLOWED_TEST_DB_NAMES.includes(dbName)) {
    throw new Error(
      `DB SAFETY GUARD${label}: refusing to touch database "${dbName}" ` +
        `(${redact(rawUrl)}). Destructive operations are only allowed against ` +
        `the whitelisted test database(s): ${ALLOWED_TEST_DB_NAMES.join(', ')}. ` +
        'This guard has no bypass — point DATABASE_URL_TEST at the dedicated test database; ' +
        'extending the whitelist requires editing server/scripts/db-safety.js.',
    );
  }
  return rawUrl;
}

module.exports = {
  assertTestDatabaseUrl,
  parseDatabaseName,
  redactDatabaseUrl: redact,
  ALLOWED_TEST_DB_NAMES,
};
