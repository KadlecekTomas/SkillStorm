/* eslint-disable @typescript-eslint/no-var-requires */
// CommonJS, ne ESM!
const { resolveTestDatabaseUrl } = require('./resolve-test-db-url');

// The test database is configured EXCLUSIVELY via DATABASE_URL_TEST
// (process env → .env.test → .env.test.example). Any inherited DATABASE_URL
// (shell export, dev server env, @prisma/client auto-loading server/.env) is
// discarded so a dev/prod URL can never leak into the destructive test
// setup (`prisma migrate reset`, `DROP SCHEMA`). This is a hard rule with
// no bypass — see server/scripts/db-safety.js.
delete process.env.DATABASE_URL;

const testUrl = resolveTestDatabaseUrl();
if (!testUrl) {
  throw new Error(
    'DATABASE_URL_TEST není nastavená — testy odmítám spustit. ' +
      'Nastav ji v server/.env.test (viz server/.env.test.example); ' +
      'musí mířit na databázi, jejíž název končí na "_test".',
  );
}

// Prisma and the app under test read DATABASE_URL; from here on it is
// guaranteed to be the guarded test URL.
process.env.DATABASE_URL = testUrl;

// Bezpečné test flagy
process.env.NODE_ENV = 'test';
process.env.DISABLE_STATS_CACHE = process.env.DISABLE_STATS_CACHE || '1';
process.env.DISABLE_CSRF = process.env.DISABLE_CSRF || '1';
process.env.DISABLE_THROTTLE = process.env.DISABLE_THROTTLE || '1';
process.env.PORT = process.env.PORT || '0';
process.env.CACHE_TTL_SECONDS = process.env.CACHE_TTL_SECONDS || '0';

// (volitelné) konzistentní časová zóna pro snapshoty/daty
process.env.TZ = process.env.TZ || 'UTC';
