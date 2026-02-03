import { PrismaClient } from '@prisma/client';
import { seed as seedRbac } from './rbac.seed';
import { seed as seedOrgs } from './orgs.seed';
import { seed as seedAcademicYears } from './academic-years.seed';
import { seed as seedUsers } from './users.seed';
import { seed as seedSubjects } from './subjects.seed';
import { seed as seedMaterials } from './materials.seed';
import { seed as seedTests } from './tests.seed';
import { seed as seedAssignments } from './assignments.seed';
import { seed as seedLevels } from './levels.seed';
import { seed as seedPlatformAdmin } from './platform-admin.seed';

export async function runSeedPipeline(prisma: PrismaClient) {
  await seedLevels(prisma);
  await seedRbac(prisma);
  await seedOrgs(prisma);
  await seedAcademicYears(prisma);
  await seedUsers(prisma);
  await seedPlatformAdmin(prisma);
  await ensureTeachersSeeded(prisma);
  await seedSubjects(prisma);
  await seedMaterials(prisma);
  await seedTests(prisma);
  await seedAssignments(prisma);
  await validateSeed(prisma);
}

async function ensureTeachersSeeded(prisma: PrismaClient) {
  const teacherCount = await prisma.teacher.count();
  if (teacherCount === 0) {
    console.warn(
      '⚠️ Seed guard: no teachers present after users seed. Aborting before subjects.',
    );
    throw new Error('Teacher records missing. Re-run users seed before continuing.');
  }
}

async function validateSeed(prisma: PrismaClient) {
  const [userCount, teacherCount, studentCount, subjectCount, testCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.teacher.count(),
      prisma.student.count(),
      prisma.subject.count(),
      prisma.test.count(),
    ]);

  console.log(
    `✅ Validation: Users=${userCount}, Teachers=${teacherCount}, Students=${studentCount}, Subjects=${subjectCount}, Tests=${testCount}`,
  );

  if (
    !teacherCount ||
    !studentCount ||
    !subjectCount ||
    !testCount
  ) {
    throw new Error('Seed validation failed – missing required demo data.');
  }
}

async function main() {
  const prisma = new PrismaClient();
  console.log('🌱 Running SkillStorm seed pipeline (index) ...');
  await runSeedPipeline(prisma);
  console.log('✅ Seed pipeline finished.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
