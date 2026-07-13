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

  // 🧹 Clean up to prevent unique constraint errors in CI
  await prisma.testAssignment.deleteMany({});
  await prisma.response.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.option.deleteMany({});
  await prisma.answer.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.test.deleteMany({});

  await runSeedPipeline(prisma);

  console.log('✅ Seed pipeline finished.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
