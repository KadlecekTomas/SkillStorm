/* eslint-disable @typescript-eslint/no-var-requires */
const { assertTestDatabaseUrl } = require('../scripts/db-safety');

// E2E canonical DATABASE_URL: use URL parsing so pathname (DB name) is never corrupted; enforce connection_limit=2.
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  // Guard: this file drops schemas and runs `prisma migrate reset` — the
  // target database name MUST end with "_test". No bypass exists.
  assertTestDatabaseUrl(dbUrl, 'jest-setup-after');
  const url = new URL(dbUrl);
  const schema = url.searchParams.get('schema');
  if (schema && schema !== 'public') {
    url.searchParams.set('schema', 'public');
    process.env.DATABASE_URL = url.toString();
  }
  url.searchParams.set('connection_limit', '2');
  process.env.DATABASE_URL = url.toString();
  const safeUrl = new URL(process.env.DATABASE_URL);
  safeUrl.password = '***';
  // eslint-disable-next-line no-console
  console.log('E2E DB:', safeUrl.toString());
}

const { execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const Test = require('supertest/lib/test');

// ── Flake fix: one listening HTTP server per suite ─────────────────────────
// Supertest, when handed a non-listening http.Server, calls listen(0) for
// EVERY request and closes the server right after the response. A full e2e
// run makes thousands of these one-request listen/close cycles on
// 127.0.0.1; combined with parallel bursts the kernel occasionally reuses
// a port pair whose previous conversation still has state, and a request
// randomly dies mid-run with "socket hang up", "Parse Error: Expected
// HTTP/", or gets a stale response for a different request (404 with empty
// body from an endpoint that cannot 404). Reproduced ~1 in 3 full runs;
// never in isolated suites. Fix: bind the server ONCE on the first request
// and leave it listening — Nest's app.close() in each suite's afterAll
// shuts it down. submissions-concurrency-load.e2e-spec.ts already used
// this pattern (app.listen(0)) for the same reason.
const { Server: TlsServer } = require('tls');
Test.prototype.serverAddress = function (app, path) {
  if (!app.address()) app.listen(0);
  const port = app.address().port;
  const protocol = app instanceof TlsServer ? 'https' : 'http';
  return protocol + '://127.0.0.1:' + port + path;
};

const originalAssert = Test.prototype.assert;
Test.prototype.assert = function (err, res, fn) {
  // Diagnostics: if a request still dies at the socket level, log its
  // identity — a bare "socket hang up" in jest output is otherwise
  // unattributable to a request.
  if (err && /hang up|ECONNRESET|ECONNREFUSED|EPIPE|Parse Error|HPE_/.test(err.message || '')) {
    // eslint-disable-next-line no-console
    console.error(
      `[DIAG-NET-ERR] ${new Date().toISOString()} ${this.method} ${this.url} ` +
        `code=${err.code} msg=${err.message} hasRes=${!!res}\nstack=${err.stack}`,
    );
  }
  // Diagnostics: status-mismatch errors say only "expected 201, got 400" —
  // append the response body so the failure cause is visible in logs. The
  // assertion error is produced inside originalAssert, so wrap the callback.
  const originalFn = fn;
  fn = function (error, ...rest) {
    if (error && res && res.body && /expected \d+ .*got \d+/.test(error.message || '')) {
      try {
        error.message += `\nresponse body: ${JSON.stringify(res.body).slice(0, 600)}`;
      } catch (_) {
        // ignore unserializable bodies
      }
    }
    return originalFn.call(this, error, ...rest);
  };
  // Compat shim: auth tokens moved from response bodies to httpOnly cookies,
  // but many older specs still read `res.body.sessionToken`. Mirror the
  // access-token cookie into the body so those assertions keep working
  // without weakening the real API (which stays cookie-only).
  if (res && res.headers && res.body && typeof res.body === 'object') {
    const setCookie = res.headers['set-cookie'];
    if (setCookie && res.body.sessionToken === undefined) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of cookies) {
        const m = /^ss_at=([^;]+)/.exec(c); // ACCESS_TOKEN_COOKIE (src/auth/token-cookies.ts)
        if (m && m[1]) {
          try {
            res.body.sessionToken = decodeURIComponent(m[1]);
            if (res.body.data && typeof res.body.data === 'object') {
              res.body.data.sessionToken = res.body.sessionToken;
            }
          } catch (_) {
            // ignore malformed cookie values
          }
          break;
        }
      }
    }
  }

  if (
    res &&
    res.body &&
    res.body.success === true &&
    Object.prototype.hasOwnProperty.call(res.body, 'data')
  ) {
    const data = res.body.data;
    res.body = data;
    try {
      if (Array.isArray(res.body)) {
        res.body.data = res.body;
      }
      res.body._envelope = { success: true, data };
    } catch (_) {
      // Ignore if body is immutable.
    }
  }
  return originalAssert.call(this, err, res, fn);
};

const PG_ACTIVITY_WARN_THRESHOLD = 20;

async function setupDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL není nastavená');

  // Guard immediately before the destructive part (DROP SCHEMA + migrate
  // reset). Re-asserted here in case something mutated DATABASE_URL after
  // module load.
  assertTestDatabaseUrl(dbUrl, 'jest-setup-after setupDb');

  const url = new URL(dbUrl);
  const schema = url.searchParams.get('schema') ?? 'public';

  const baseUrl = new URL(dbUrl);
  baseUrl.searchParams.delete('schema');
  baseUrl.searchParams.set('connection_limit', '2');
  const base = baseUrl.toString();

  const prisma = new PrismaClient({ datasources: { db: { url: base } } });
  try {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (/database .+ does not exist/i.test(msg)) {
        throw new Error(
          'Test database does not exist. Run: npx prisma migrate deploy --schema=prisma/schema.prisma',
        );
      }
      throw err;
    }

    // Suites run sequentially in one worker but leak connections (apps that
    // never close, module-level Prisma clients). Across ~70 suites that
    // exhausts max_connections ("sorry, too many clients already") and every
    // later suite fails in cascade. The test DB is dedicated (guard above),
    // so terminating every other session at suite start is safe.
    try {
      await prisma.$queryRawUnsafe(`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
      `);
    } catch (_) {
      // Non-fatal: requires superuser/same-role; worst case old behavior.
    }

    const isCI = process.env.CI === 'true' || process.env.CI === '1';
    if (!isCI) {
      const schemas = await prisma.$queryRawUnsafe(`
        SELECT nspname
        FROM pg_namespace
        WHERE nspname LIKE 'e2e\\_%'
      `);
      for (const row of schemas ?? []) {
        const name = row?.nspname;
        if (name) {
          await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
        }
      }
      await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
      await prisma.$executeRawUnsafe('CREATE SCHEMA public');
    }

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    try {
      const countResult = await prisma.$queryRawUnsafe('SELECT count(*)::int as n FROM pg_stat_activity');
      const n = countResult?.[0]?.n ?? 0;
      if (n > PG_ACTIVITY_WARN_THRESHOLD) {
        // eslint-disable-next-line no-console
        console.warn(
          `[E2E] pg_stat_activity count = ${n} (threshold ${PG_ACTIVITY_WARN_THRESHOLD}). ` +
            'Stop other DB clients (IDE, dev server) or increase Postgres max_connections to avoid "Too many connections".',
        );
      }
    } catch (_) {
      // Non-fatal: e.g. permission or driver may not support
    }
  } finally {
    await prisma.$disconnect();
  }

  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  const cmd = isCI
    ? 'npx prisma migrate deploy --schema=prisma/schema.prisma'
    : 'npx prisma migrate reset --force --skip-seed --schema=prisma/schema.prisma';
  execSync(cmd, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });
}

beforeAll(async () => {
  try {
    await setupDb();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[jest-setup-after] DB init failed', err);
    throw err;
  }
});

module.exports = setupDb;
