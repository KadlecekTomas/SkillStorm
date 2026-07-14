/**
 * Regression tests for the DB safety guard (server/scripts/db-safety.js).
 *
 * Context: an e2e run once wiped the dev database because test setup
 * inherited a dev DATABASE_URL and ran `prisma migrate reset`. The guard is
 * the single choke point preventing that; these tests pin its contract:
 * only explicitly whitelisted test database names are accepted (a bare
 * "_test" suffix is not enough), and there is no environment-variable bypass.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  assertTestDatabaseUrl,
  parseDatabaseName,
} = require('../../scripts/db-safety');

describe('db-safety guard', () => {
  it('accepts a *_test database', () => {
    expect(() =>
      assertTestDatabaseUrl(
        'postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public',
      ),
    ).not.toThrow();
  });

  it('returns the URL unchanged so it can be used inline', () => {
    const url = 'postgresql://u:p@localhost:5434/skillstorm_test';
    expect(assertTestDatabaseUrl(url)).toBe(url);
  });

  it('rejects the dev database', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/skillstorm'),
    ).toThrow(/refusing to touch database "skillstorm"/);
  });

  it('rejects a prod-looking database', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://u:p@db.example.com:5432/skillstorm_prod'),
    ).toThrow(/DB SAFETY GUARD/);
  });

  it('rejects names where _test is not a suffix', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://u:p@localhost:5432/skillstorm_test_backup'),
    ).toThrow(/DB SAFETY GUARD/);
  });

  it('rejects non-whitelisted names even with a _test suffix', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://u:p@localhost:5432/skillstorm_production_test'),
    ).toThrow(/DB SAFETY GUARD/);
    expect(() =>
      assertTestDatabaseUrl('postgresql://u:p@localhost:5432/foo_test'),
    ).toThrow(/DB SAFETY GUARD/);
  });

  it('rejects a missing URL', () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/no database URL/);
    expect(() => assertTestDatabaseUrl('')).toThrow(/no database URL/);
  });

  it('rejects an unparsable URL', () => {
    expect(() => assertTestDatabaseUrl('not-a-url')).toThrow(/could not parse/);
  });

  it('rejects a URL without a database name', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/'),
    ).toThrow(/DB SAFETY GUARD/);
  });

  it('cannot be bypassed via environment variables', () => {
    // The guard reads nothing from process.env — flooding it with plausible
    // override flags must not change the outcome.
    const bypassAttempts = {
      DB_SAFETY_SKIP: '1',
      SKIP_DB_GUARD: '1',
      ALLOW_UNSAFE_DB: '1',
      FORCE: '1',
      CI: 'true',
      NODE_ENV: 'test',
    };
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(bypassAttempts)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    try {
      expect(() =>
        assertTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/skillstorm'),
      ).toThrow(/DB SAFETY GUARD/);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('never leaks the password in error messages', () => {
    try {
      assertTestDatabaseUrl('postgresql://admin:SuperSecret123@db.prod:5432/skillstorm');
      throw new Error('expected guard to throw');
    } catch (err) {
      expect((err as Error).message).not.toContain('SuperSecret123');
    }
  });

  it('parses database names correctly', () => {
    expect(parseDatabaseName('postgresql://u:p@h:5432/skillstorm_test?schema=public')).toBe(
      'skillstorm_test',
    );
    expect(parseDatabaseName('postgres://u:p@h/skillstorm%5Ftest')).toBe('skillstorm_test');
  });
});
