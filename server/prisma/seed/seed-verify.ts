/**
 * Self-verification checklist for full-production seed.
 * Run: npm run seed:verify (from server/)
 *
 * 1) DB schema checks (users.password_changed_at, token_version)
 * 2) Count checks (demo orgs, sections, users, tests, assignments, submissions)
 * 3) Optional: login + API sanity (requires app bootstrap)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let failed = false;

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
}
function fail(msg: string): void {
  console.log(`FAIL: ${msg}`);
  failed = true;
}

async function checkSchema(): Promise<void> {
  const r = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name IN ('password_changed_at', 'token_version')
  `;
  const cols = r.map((x) => x.column_name);
  if (cols.includes('password_changed_at')) pass('users.password_changed_at exists');
  else fail('users.password_changed_at missing');
  if (cols.includes('token_version')) pass('users.token_version exists');
  else fail('users.token_version missing');
}

async function checkCounts(): Promise<void> {
  const demoOrgs = await prisma.organization.findMany({
    where: {
      deletedAt: null,
      memberships: {
        some: {
          user: { email: { endsWith: '.demo.local' } },
        },
      },
    },
    select: { id: true },
  });
  if (demoOrgs.length >= 3) pass(`demo orgs >= 3 (${demoOrgs.length})`);
  else fail(`demo orgs: expected >= 3, got ${demoOrgs.length}`);

  const schoolOrgIds = await prisma.organization.findMany({
    where: { type: 'SCHOOL', deletedAt: null, id: { in: demoOrgs.map((o) => o.id) } },
    select: { id: true },
  });
  for (const org of schoolOrgIds) {
    const currentYears = await prisma.academicYear.findMany({
      where: { orgId: org.id, isCurrent: true },
      select: { id: true },
    });
    const sectionCount = await prisma.classSection.count({
      where: {
        orgId: org.id,
        yearId: { in: currentYears.map((y) => y.id) },
        label: { in: ['6.A', '7.B', '8.C'] },
      },
    });
    if (sectionCount >= 3) pass(`class sections (current year) >= 3 for org (${sectionCount})`);
    else fail(`class sections for SCHOOL org: expected >= 3, got ${sectionCount}`);
  }

  const demoUserCount = await prisma.user.count({
    where: { email: { endsWith: '.demo.local' } },
  });
  const expectedMinUsers = 3 * 2 + 2 * 3 * 12;
  if (demoUserCount >= expectedMinUsers) pass(`demo users >= ${expectedMinUsers} (${demoUserCount})`);
  else fail(`demo users: expected >= ${expectedMinUsers}, got ${demoUserCount}`);

  const testCount = await prisma.test.count({ where: { deletedAt: null } });
  const expectedMinTests = 2 * 2 * 12;
  if (testCount >= expectedMinTests) pass(`tests >= ${expectedMinTests} (${testCount})`);
  else fail(`tests: expected >= ${expectedMinTests}, got ${testCount}`);

  const assignCount = await prisma.assignment.count();
  const expectedMinAssign = 2 * 3 * 4;
  if (assignCount >= expectedMinAssign) pass(`assignments >= ${expectedMinAssign} (${assignCount})`);
  else fail(`assignments: expected >= ${expectedMinAssign}, got ${assignCount}`);

  const subCount = await prisma.submission.count({ where: { deletedAt: null } });
  if (subCount > 0) pass(`submissions > 0 (${subCount})`);
  else fail(`submissions: expected > 0, got ${subCount}`);
}

/**
 * Scoring integrity check.
 *
 * An "impossible state" is a APPROVED submission where:
 *   - score > 0  AND  all responses have isCorrect = false
 *   - score = 0  AND  at least one response has isCorrect = true
 *
 * These states can only arise if the seed (or a bug) wrote score and
 * isCorrect from different sources instead of using computeScore().
 */
async function checkScoringIntegrity(): Promise<void> {
  // Submissions with score > 0 but no correct responses
  const impossiblePositive = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
    SELECT s.id, s.score
    FROM submissions s
    WHERE s.status = 'APPROVED'
      AND s.score > 0
      AND s.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM responses r
        WHERE r.submission_id = s.id AND r.is_correct = true
      )
  `;

  if (impossiblePositive.length === 0) {
    pass('No impossible-positive submissions (score>0 but 0 correct responses)');
  } else {
    fail(
      `Found ${impossiblePositive.length} impossible-positive submission(s): ` +
        impossiblePositive.map((s) => `${s.id}(score=${s.score})`).join(', '),
    );
  }

  // Submissions with score = 0 but at least one correct response
  const impossibleZero = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT s.id
    FROM submissions s
    WHERE s.status = 'APPROVED'
      AND s.score = 0
      AND s.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM responses r
        WHERE r.submission_id = s.id AND r.is_correct = true
      )
  `;

  if (impossibleZero.length === 0) {
    pass('No impossible-zero submissions (score=0 but has correct responses)');
  } else {
    fail(
      `Found ${impossibleZero.length} impossible-zero submission(s): ` +
        impossibleZero.map((s) => s.id).join(', '),
    );
  }

  // Basic sanity: APPROVED submissions must have a non-null score
  const nullScore = await prisma.submission.count({
    where: { status: 'APPROVED', score: null, deletedAt: null },
  });
  if (nullScore === 0) {
    pass('All APPROVED submissions have a non-null score');
  } else {
    fail(`${nullScore} APPROVED submission(s) have null score`);
  }
}

async function main(): Promise<void> {
  console.log('--- Seed verification ---\n');
  await checkSchema();
  console.log('');
  await checkCounts();
  console.log('');
  await checkScoringIntegrity();
  console.log('');
  if (failed) {
    console.log('Verification finished with FAILs.');
    process.exit(1);
  }
  console.log('All checks passed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
