import { PrismaClient } from '@prisma/client';
import { runSeedPipeline } from './index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

// This seed WIPES tables. It may only ever run against a *_test database.
// Prefer DATABASE_URL_TEST; fall back to DATABASE_URL (e.g. CI job env) —
// either way the guard enforces the "_test" name suffix with no bypass.
const databaseUrl = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'e2e-seed',
);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log('🌱 Starting full SkillStorm E2E seed...');

  // 🧹 Clean up to prevent unique constraint errors in CI.
  // The submission-immutability DB trigger (SUBMISSION_LOCKED) blocks deleting
  // responses of approved submissions; for a *_test-only wipe we disable
  // triggers for this one transaction (SET LOCAL ends with the transaction,
  // and the assertTestDatabaseUrl guard above means this never touches a
  // real database).
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL session_replication_role = 'replica'`,
    );
    await tx.testAssignment.deleteMany({});
    await tx.response.deleteMany({});
    await tx.submission.deleteMany({});
    await tx.assignment.deleteMany({});
    await tx.option.deleteMany({});
    await tx.answer.deleteMany({});
    await tx.question.deleteMany({});
    await tx.test.deleteMany({});
    // Subject/catalog domain too: the pipeline's idempotent upserts assume
    // either its own rows or an empty domain. Leftovers from other suites
    // (e.g. the policy scorecard run in the same CI job) would otherwise
    // resolve a foreign "Mathematics" subject with no matching topic levels.
    await tx.materialPurchase.deleteMany({});
    await tx.materialAssignment.deleteMany({});
    await tx.learningMaterial.deleteMany({});
    await tx.topicLevel.deleteMany({});
    await tx.subjectLevel.deleteMany({});
    await tx.teacherSubject.deleteMany({});
    await tx.classSectionOrgSubject.deleteMany({});
    await tx.orgSubject.deleteMany({});
    await tx.catalogTopic.deleteMany({});
    await tx.subject.deleteMany({});
    await tx.catalogSubject.deleteMany({});
  });

  await runSeedPipeline(prisma);

  console.log('✅ Seed pipeline finished.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
