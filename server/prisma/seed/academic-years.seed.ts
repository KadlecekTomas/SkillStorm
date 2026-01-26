import { PrismaClient, SchoolGrade } from '@prisma/client';
import { ACADEMIC_YEAR_ID, CLASS_SECTION_IDS, ORG_IDS } from './seed-constants';
import { logDone, logStep } from './seed-helpers';

const STARTS_AT = new Date('2025-09-01T00:00:00.000Z');
const ENDS_AT = new Date('2026-06-30T00:00:00.000Z');

export async function seed(prisma: PrismaClient) {
  logStep('AcademicYears > creating demo year + classrooms');

  const orgId = ORG_IDS.chodovicka;

  await prisma.academicYear.upsert({
    where: { id: ACADEMIC_YEAR_ID },
    update: {
      orgId,
      label: '2025/26',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      isCurrent: true,
    },
    create: {
      id: ACADEMIC_YEAR_ID,
      orgId,
      label: '2025/26',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      isCurrent: true,
    },
  });

  await prisma.academicYear.updateMany({
    where: { orgId, id: { not: ACADEMIC_YEAR_ID }, isCurrent: true },
    data: { isCurrent: false },
  });

  await prisma.classSection.upsert({
    where: { id: CLASS_SECTION_IDS.chodovickaA },
    update: {
      orgId,
      yearId: ACADEMIC_YEAR_ID,
      grade: SchoolGrade.GRADE_5,
      section: 'A',
      label: '5.A',
    },
    create: {
      id: CLASS_SECTION_IDS.chodovickaA,
      orgId,
      yearId: ACADEMIC_YEAR_ID,
      grade: SchoolGrade.GRADE_5,
      section: 'A',
      label: '5.A',
    },
  });

  await prisma.classSection.upsert({
    where: { id: CLASS_SECTION_IDS.chodovickaB },
    update: {
      orgId,
      yearId: ACADEMIC_YEAR_ID,
      grade: SchoolGrade.GRADE_5,
      section: 'B',
      label: '5.B',
    },
    create: {
      id: CLASS_SECTION_IDS.chodovickaB,
      orgId,
      yearId: ACADEMIC_YEAR_ID,
      grade: SchoolGrade.GRADE_5,
      section: 'B',
      label: '5.B',
    },
  });

  logDone('AcademicYears ready');
}
