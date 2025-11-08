import { PrismaClient } from '@prisma/client';

const LEVELS = [
  { levelNo: 1, minXp: 0 },
  { levelNo: 2, minXp: 50 },
  { levelNo: 3, minXp: 150 },
  { levelNo: 4, minXp: 350 },
  { levelNo: 5, minXp: 750 },
  { levelNo: 6, minXp: 1500 },
  { levelNo: 7, minXp: 3000 },
  { levelNo: 8, minXp: 5000 },
  { levelNo: 9, minXp: 8000 },
  { levelNo: 10, minXp: 12000 },
];

export async function seed(prisma: PrismaClient) {
  await prisma.level.createMany({
    data: LEVELS,
    skipDuplicates: true,
  });
  console.log('✅ Levels seeded');
}
