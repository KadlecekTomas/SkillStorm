import { PrismaClient } from '@prisma/client';
import { runSeedPipeline } from './index';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting full SkillStorm E2E seed...');

  // 🧹 Prevent duplicate unique constraint errors in CI
  // Some CI runners trigger the seed multiple times — clean critical tables first
  await prisma.teacher.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.membership.deleteMany({});

  // 🚀 Run the full seeding pipeline
  await runSeedPipeline(prisma);

  console.log('✅ Seed pipeline finished.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
