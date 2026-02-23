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

async function main(): Promise<void> {
  console.log('--- Seed verification ---\n');
  await checkSchema();
  console.log('');
  await checkCounts();
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
