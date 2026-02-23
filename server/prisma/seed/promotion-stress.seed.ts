/**
 * Stress seed for promotion: 30 classrooms, 25 students per class (750 enrollments),
 * 2 academic years (fromYear ended, toYear current).
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed/promotion-stress.seed.ts
 * Or from server: npm run build && node dist/prisma/seed/promotion-stress.seed.js (if compiled)
 *
 * After seeding, run promotion via API (POST /academic-years/:fromYearId/promote)
 * or use the promotion-stress-run script. Server logs will show:
 *   Promotion completed: org=... classrooms=30 students=... durationMs=...
 */
import { PrismaClient, OrganizationRole, OrganizationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STRESS_ORG_NAME = 'Promotion Stress School';
const STRESS_DIRECTOR_EMAIL = 'promotion-stress-director@example.com';
const STRESS_PASSWORD = 'StressPromo123!';

const CLASSROOMS = 30;
const STUDENTS_PER_CLASS = 25; // 30 * 25 = 750 enrollments

const GRADES = [
  'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5',
  'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9',
] as const;

export async function runPromotionStressSeed(prismaInstance: PrismaClient = prisma) {
  const start = Date.now();
  console.log('[promotion-stress] Starting stress seed...');

  let org = await prismaInstance.organization.findFirst({
    where: { name: STRESS_ORG_NAME },
    select: { id: true },
  });
  if (!org) {
    org = await prismaInstance.organization.create({
      data: { name: STRESS_ORG_NAME, status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });
  } else {
    await prismaInstance.organization.update({
      where: { id: org.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
  }

  const pastEnd = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fromStart = new Date(pastEnd);
  fromStart.setFullYear(fromStart.getFullYear() - 1);
  fromStart.setMonth(8, 1);

  let fromYear = await prismaInstance.academicYear.findFirst({
    where: { orgId: org.id, label: 'StressFrom' },
    select: { id: true },
  });
  if (!fromYear) {
    fromYear = await prismaInstance.academicYear.create({
      data: {
        orgId: org.id,
        label: 'StressFrom',
        startsAt: fromStart,
        endsAt: pastEnd,
        isCurrent: false,
      },
      select: { id: true },
    });
  }

  const toStart = new Date(pastEnd.getTime() + 24 * 60 * 60 * 1000);
  const toEnd = new Date(toStart);
  toEnd.setFullYear(toEnd.getFullYear() + 1);

  let toYear = await prismaInstance.academicYear.findFirst({
    where: { orgId: org.id, label: 'StressTo' },
    select: { id: true },
  });
  if (!toYear) {
    toYear = await prismaInstance.academicYear.create({
      data: {
        orgId: org.id,
        label: 'StressTo',
        startsAt: toStart,
        endsAt: toEnd,
        isCurrent: true,
      },
      select: { id: true },
    });
  } else {
    await prismaInstance.academicYear.update({
      where: { id: toYear.id },
      data: { isCurrent: true },
    });
  }

  const passwordHash = await bcrypt.hash(STRESS_PASSWORD, 10);
  let directorUser = await prismaInstance.user.findUnique({
    where: { email: STRESS_DIRECTOR_EMAIL },
    select: { id: true },
  });
  if (!directorUser) {
    directorUser = await prismaInstance.user.create({
      data: {
        email: STRESS_DIRECTOR_EMAIL,
        name: 'Stress Director',
        passwordHash,
      },
      select: { id: true },
    });
  }

  let membership = await prismaInstance.membership.findFirst({
    where: { userId: directorUser.id, organizationId: org.id },
    select: { id: true },
  });
  if (!membership) {
    membership = await prismaInstance.membership.create({
      data: {
        userId: directorUser.id,
        organizationId: org.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
  }
  await prismaInstance.user.update({
    where: { id: directorUser.id },
    data: { lastActiveMembershipId: membership.id },
  });

  await prismaInstance.enrollment.deleteMany({ where: { orgId: org.id, yearId: fromYear.id } });
  await prismaInstance.classSection.deleteMany({
    where: { orgId: org.id, yearId: fromYear.id },
  });

  const sections: { id: string }[] = [];
  for (let i = 0; i < CLASSROOMS; i++) {
    const grade = GRADES[i % GRADES.length]!;
    const sectionLetter = String.fromCharCode(65 + (i % 3));
    const label = `${grade.replace('GRADE_', '')}.${sectionLetter}`;
    const section = await prismaInstance.classSection.create({
      data: {
        orgId: org.id,
        yearId: fromYear.id,
        grade,
        section: sectionLetter,
        label,
      },
      select: { id: true },
    });
    sections.push(section);
  }

  let totalStudents = 0;
  const studentIds: string[] = [];
  for (let s = 0; s < sections.length; s++) {
    const n = STUDENTS_PER_CLASS;
    for (let i = 0; i < n; i++) {
      const email = `promotion-stress-${s}-${i}-${Date.now()}@example.com`;
      const user = await prismaInstance.user.create({
        data: {
          email,
          name: `Student ${s}-${i}`,
          passwordHash: 'x',
        },
        select: { id: true },
      });
      const mem = await prismaInstance.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      });
      const student = await prismaInstance.student.create({
        data: {
          membershipId: mem.id,
          orgId: org.id,
        },
        select: { id: true },
      });
      studentIds.push(student.id);
      const section = sections[s];
      if (!section) continue;
      await prismaInstance.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: section.id,
          yearId: fromYear.id,
          orgId: org.id,
        },
      });
      totalStudents += 1;
    }
  }

  const duration = Date.now() - start;
  console.log(
    `[promotion-stress] Seed complete: org=${org.id} fromYear=${fromYear.id} ` +
      `classrooms=${sections.length} students=${totalStudents} durationMs=${duration}`,
  );
  console.log(`[promotion-stress] Director: ${STRESS_DIRECTOR_EMAIL} / ${STRESS_PASSWORD}`);
  return { orgId: org.id, fromYearId: fromYear.id, totalStudents, classrooms: sections.length, durationMs: duration };
}

async function main() {
  await runPromotionStressSeed();
  await prisma.$disconnect();
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
