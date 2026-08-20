import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../../server/scripts/db-safety.js');

/**
 * Scenario suite global setup — runs ONCE before scenario execution.
 *
 * Normal scenario mode:
 * 1. Enforces the *_test DB guard (no dev/prod DB, no bypass).
 * 2. Brings the schema up to date (migrate deploy) and runs the deterministic
 *    scenario seed (server/prisma/seed/scenarios-e2e.seed.ts), whose own wipe
 *    resets the scenario data idempotently.
 * 3. Applies presentation-safe ZŠ data (realistic display names/year/copy)
 *    without changing technical account identifiers used by tests.
 * 4. Adds verified PARENT, progress/RBAC and platform fixtures.
 * 5. Captures the combined manifest (accounts, ids) to
 *    tests/scenarios/.manifest.json for auth.setup + specs.
 *
 * Product-certification preseed mode:
 * - the exact same setup function is invoked BEFORE the production backend is
 *   started, so the production SUPERADMIN invariant can be satisfied by real
 *   seeded data instead of weakening bootstrap validation;
 * - Playwright later invokes globalSetup again with SCENARIO_PRESEEDED=1 and
 *   only validates/reuses the manifest, avoiding a destructive reseed while
 *   the production application is serving traffic.
 *
 * DB work is pure Prisma (migrate deploy + seed) — no psql needed. Crucially
 * it NEVER drops the database: Playwright may run against an already-started
 * backend and a DROP would force-close live connections.
 */
export const MANIFEST_PATH = join(__dirname, '.manifest.json');

function validatePreseededManifest(): void {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `SCENARIO_PRESEEDED=1 but manifest does not exist: ${MANIFEST_PATH}`,
    );
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
    orgId?: string;
    students8A?: unknown[];
    accounts?: { superadmin?: string };
    superadminUserId?: string;
  };

  if (
    !manifest.orgId ||
    !Array.isArray(manifest.students8A) ||
    manifest.students8A.length !== 30 ||
    !manifest.accounts?.superadmin ||
    !manifest.superadminUserId
  ) {
    throw new Error(
      'Preseeded scenario manifest is incomplete; expected org, 30 students and SUPERADMIN fixture.',
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[scenarios] reusing preseeded org=${manifest.orgId} (8.A ${manifest.students8A.length}, superadmin=1)`,
  );
}

export default async function globalSetup() {
  const dbUrl = assertTestDatabaseUrl(
    process.env.DATABASE_URL_TEST ||
      'postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public',
    'scenarios global-setup',
  );

  if (process.env.SCENARIO_PRESEEDED === '1') {
    validatePreseededManifest();
    return;
  }

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

  const productOut = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-zs-product-extension.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const productLine = productOut
    .split('\n')
    .find((l) => l.startsWith('SCENARIO_ZS_PRODUCT_EXTENSION='));
  if (!productLine) {
    throw new Error(
      'ZŠ product scenario extension did not emit SCENARIO_ZS_PRODUCT_EXTENSION',
    );
  }

  const parentOut = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-parent-extension.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const parentLine = parentOut
    .split('\n')
    .find((l) => l.startsWith('SCENARIO_PARENT_EXTENSION='));
  if (!parentLine) {
    throw new Error(
      'parent scenario extension did not emit SCENARIO_PARENT_EXTENSION',
    );
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
    throw new Error(
      'progress scenario extension did not emit SCENARIO_PROGRESS_EXTENSION',
    );
  }
  const progress = JSON.parse(
    progressLine.replace('SCENARIO_PROGRESS_EXTENSION=', ''),
  );
  manifest.teacherSubjectId = progress.teacherSubjectId;
  manifest.untaughtClassId = progress.untaughtClassId;
  manifest.unrelatedStudentId = progress.unrelatedStudentId;

  const platformOut = execSync(
    'npx ts-node --transpile-only prisma/seed/scenarios-platform-extension.ts',
    { cwd: serverDir, env: { ...process.env, DATABASE_URL_TEST: dbUrl } },
  ).toString();
  const platformLine = platformOut
    .split('\n')
    .find((l) => l.startsWith('SCENARIO_PLATFORM_EXTENSION='));
  if (!platformLine) {
    throw new Error(
      'platform scenario extension did not emit SCENARIO_PLATFORM_EXTENSION',
    );
  }
  const platform = JSON.parse(
    platformLine.replace('SCENARIO_PLATFORM_EXTENSION=', ''),
  );
  manifest.accounts = {
    ...manifest.accounts,
    superadmin: platform.superadmin,
  };
  manifest.superadminUserId = platform.superadminUserId;

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    `[scenarios] seeded org=${manifest.orgId} (8.A ${manifest.students8A.length}, 2.A ${manifest.students2A.length}, parent=1, progress-scope=1, superadmin=1, zs-product=1)`,
  );
}
