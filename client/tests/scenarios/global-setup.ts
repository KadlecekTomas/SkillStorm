import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../../server/scripts/db-safety.js');

/**
 * Scenario suite global setup — runs ONCE before webServer boots.
 *
 * 1. Enforces the *_test DB guard (no dev/prod DB, no bypass).
 * 2. Brings the schema up to date (migrate deploy) and runs the deterministic
 *    scenario seed (server/prisma/seed/scenarios-e2e.seed.ts), whose own wipe
 *    resets the scenario data idempotently.
 * 3. Adds verified PARENT and progress/RBAC fixtures.
 * 4. Captures the combined manifest (accounts, ids) to
 *    tests/scenarios/.manifest.json for auth.setup + specs.
 *
 * DB work is pure Prisma (migrate deploy + seed) — no psql needed. Crucially
 * it NEVER drops the database: Playwright brings up the webServer (backend)
 * around the same time, and a DROP would force-close its live connections so
 * the first login fails with "Server has closed the connection".
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

  if (process.env.SCENARIO_REUSE_DB !== '1') {
    // eslint-disable-next-line no-console
    console.log(`[scenarios] migrating ${dbName} …`);
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

  const parentOut = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-parent-extension.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const parentLine = parentOut
    .split('\n')
    .find((l) => l.startsWith('SCENARIO_PARENT_EXTENSION='));
  if (!parentLine) {
    throw new Error('parent scenario extension did not emit SCENARIO_PARENT_EXTENSION');
  }
  const parent = JSON.parse(
    parentLine.replace('SCENARIO_PARENT_EXTENSION=', ''),
  );
  manifest.accounts = { ...manifest.accounts, parent: parent.parent };
  manifest.parentMembershipId = parent.parentMembershipId;
  manifest.parentUserId = parent.parentUserId;
  manifest.parentRelationId = parent.parentRelationId;

  const progressOut = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-progress-extension.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const progressLine = progressOut
    .split('\n')
    .find((l) => l.startsWith('SCENARIO_PROGRESS_EXTENSION='));
  if (!progressLine) {
    throw new Error('progress scenario extension did not emit SCENARIO_PROGRESS_EXTENSION');
  }
  const progress = JSON.parse(
    progressLine.replace('SCENARIO_PROGRESS_EXTENSION=', ''),
  );
  manifest.teacherSubjectId = progress.teacherSubjectId;
  manifest.untaughtClassId = progress.untaughtClassId;
  manifest.unrelatedStudentId = progress.unrelatedStudentId;

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    `[scenarios] seeded org=${manifest.orgId} (8.A ${manifest.students8A.length}, 2.A ${manifest.students2A.length}, parent=1, progress-scope=1)`,
  );
}
