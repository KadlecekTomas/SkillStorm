import { PrismaClient } from '@prisma/client';
import { runSeedPipeline } from './index';

const prisma = new PrismaClient();

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
