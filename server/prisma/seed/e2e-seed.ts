import { PrismaClient } from '@prisma/client';
import { runSeedPipeline } from './index';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting full SkillStorm E2E seed...');
  await runSeedPipeline(prisma);
  console.log('✅ Seed pipeline finished.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
