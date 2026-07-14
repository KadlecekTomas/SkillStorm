import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../../server/scripts/db-safety.js');

/**
 * Scenario suite global setup — runs ONCE before webServer boots.
 *
 * 1. Enforces the *_test DB guard (no dev/prod DB, no bypass).
 * 2. Recreates skillstorm_test from scratch, applies migrations, and runs
 *    the deterministic scenario seed (server/prisma/seed/scenarios-e2e.seed.ts).
 * 3. Captures the seed manifest (accounts, ids) to tests/scenarios/.manifest.json
 *    for the auth.setup + specs.
 *
 * DB work is pure Prisma/psql — the backend does not need to be up yet
 * (webServer starts after this, pointed at the freshly seeded DB).
 */
export const MANIFEST_PATH = join(__dirname, '.manifest.json');

export default async function globalSetup() {
  const dbUrl = assertTestDatabaseUrl(
    process.env.DATABASE_URL_TEST ||
      'postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public',
    'scenarios global-setup',
  );
  const serverDir = join(__dirname, '..', '..', '..', 'server');
  const url = new URL(dbUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = ''; // psql rejects ?schema=… in the connection URI

  const psql = (sql: string, target = adminUrl.toString()) =>
    execSync(`psql "${target}" -v ON_ERROR_STOP=1 -c '${sql.replace(/'/g, "'\\''")}'`, {
      stdio: 'pipe',
    });

  // Skip the destructive recreate when SCENARIO_REUSE_DB=1 (fast local reruns).
  if (process.env.SCENARIO_REUSE_DB !== '1') {
    // eslint-disable-next-line no-console
    console.log(`[scenarios] recreating ${dbName} …`);
    psql(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    psql(`CREATE DATABASE "${dbName}"`);
    execSync('npx prisma migrate deploy', {
      cwd: serverDir,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
  }

  // eslint-disable-next-line no-console
  console.log('[scenarios] seeding …');
  const out = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-e2e.seed.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const line = out.split('\n').find((l) => l.startsWith('SCENARIO_MANIFEST='));
  if (!line) {
    throw new Error('scenario seed did not emit SCENARIO_MANIFEST');
  }
  const manifest = JSON.parse(line.replace('SCENARIO_MANIFEST=', ''));
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    `[scenarios] seeded org=${manifest.orgId} (8.A ${manifest.students8A.length}, 2.A ${manifest.students2A.length})`,
  );
}
