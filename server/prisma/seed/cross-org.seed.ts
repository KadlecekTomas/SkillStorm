import {
  OrganizationRole,
  PrismaClient,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { CROSS_ORG, PASSWORDS } from './seed-constants';
import { hashPassword, logDone, logStep } from './seed-helpers';

const YEAR_START = new Date('2025-09-01T00:00:00.000Z');
const YEAR_END = new Date('2026-08-31T00:00:00.000Z');
const OPEN_AT = new Date('2025-10-01T08:00:00.000Z');
// Deliberately far in the future so the assignment stays open for the e2e cross-org test.
const CLOSE_AT = new Date('2026-12-31T18:00:00.000Z');

/** Upsert a user + org membership (+ teacher or student record/enrollment). Returns membershipId. */
async function upsertMember(
  prisma: PrismaClient,
  params: {
    email: string;
    name: string;
    orgId: string;
    role: OrganizationRole;
    passwordHash: string;
    asTeacher?: boolean;
    asStudent?: boolean;
    classSectionId?: string;
    yearId?: string;
  },
): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { email: params.email },
    select: { id: true },
  });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: params.name },
        select: { id: true },
      })
    : await prisma.user.create({
        data: {
          email: params.email,
          name: params.name,
          passwordHash: params.passwordHash,
        },
        select: { id: true },
      });

  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: params.orgId },
    },
    update: { role: params.role },
    create: {
      userId: user.id,
      organizationId: params.orgId,
      role: params.role,
    },
    select: { id: true },
  });

  if (params.asTeacher) {
    const hasTeacher = await prisma.teacher.findFirst({
      where: { membershipId: membership.id },
      select: { id: true },
    });
    if (!hasTeacher) {
      await prisma.teacher.create({
        data: { membershipId: membership.id, organizationId: params.orgId },
      });
    }
  }

  if (params.asStudent && params.classSectionId && params.yearId) {
    let student = await prisma.student.findFirst({
      where: { membershipId: membership.id },
      select: { id: true },
    });
    if (!student) {
      student = await prisma.student.create({
        data: { membershipId: membership.id, orgId: params.orgId },
        select: { id: true },
      });
    }
    const enrolled = await prisma.enrollment.findFirst({
      where: { studentId: student.id, classSectionId: params.classSectionId },
      select: { id: true },
    });
    if (!enrolled) {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: params.classSectionId,
          yearId: params.yearId,
          orgId: params.orgId,
        },
      });
    }
  }

  return membership.id;
}

/**
 * Cross-tenant negative fixture in a SECOND organization (skillStormDemo): its own academic
 * year, class, teacher, student, test and an OPEN assignment. This gives the focus e2e suite a
 * real "exists-but-forbidden" assignment so it can prove tenant isolation rather than just
 * unknown-id handling. Idempotent (stable ids + upserts).
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  logStep('Cross-org > foreign-org assignment (tenant isolation fixture)');
  const orgId = CROSS_ORG.orgId;
  const passwordHash = await hashPassword(PASSWORDS.default);

  // 1) Academic year (current for org B) + class section.
  await prisma.academicYear.upsert({
    where: { id: CROSS_ORG.academicYearId },
    update: {
      orgId,
      label: '2025/2026',
      startsAt: YEAR_START,
      endsAt: YEAR_END,
      isCurrent: true,
    },
    create: {
      id: CROSS_ORG.academicYearId,
      orgId,
      label: '2025/2026',
      startsAt: YEAR_START,
      endsAt: YEAR_END,
      isCurrent: true,
    },
  });
  await prisma.classSection.upsert({
    where: { id: CROSS_ORG.classSectionId },
    update: {
      orgId,
      yearId: CROSS_ORG.academicYearId,
      grade: SchoolGrade.GRADE_6,
      section: 'A',
      label: '6.A',
    },
    create: {
      id: CROSS_ORG.classSectionId,
      orgId,
      yearId: CROSS_ORG.academicYearId,
      grade: SchoolGrade.GRADE_6,
      section: 'A',
      label: '6.A',
    },
  });

  // 2) Teacher (creator) + student (enrolled) in org B.
  const teacherMembershipId = await upsertMember(prisma, {
    email: CROSS_ORG.teacherEmail,
    name: 'Tereza Cizí (učitelka)',
    orgId,
    role: OrganizationRole.TEACHER,
    passwordHash,
    asTeacher: true,
  });
  await upsertMember(prisma, {
    email: CROSS_ORG.studentEmail,
    name: 'Standa Cizí (žák)',
    orgId,
    role: OrganizationRole.STUDENT,
    passwordHash,
    asStudent: true,
    classSectionId: CROSS_ORG.classSectionId,
    yearId: CROSS_ORG.academicYearId,
  });

  // 3) Published test in org B with a single question.
  await prisma.test.upsert({
    where: { id: CROSS_ORG.testId },
    update: {
      organizationId: orgId,
      title: 'Cizí test (jiná organizace)',
      description: 'Fixture pro cross-org tenant izolaci.',
      academicYearId: CROSS_ORG.academicYearId,
      allowedGrades: [SchoolGrade.GRADE_6],
      status: PublishStatus.PUBLISHED,
      creatorId: teacherMembershipId,
    },
    create: {
      id: CROSS_ORG.testId,
      organizationId: orgId,
      title: 'Cizí test (jiná organizace)',
      description: 'Fixture pro cross-org tenant izolaci.',
      academicYearId: CROSS_ORG.academicYearId,
      allowedGrades: [SchoolGrade.GRADE_6],
      status: PublishStatus.PUBLISHED,
      creatorId: teacherMembershipId,
    },
  });
  await prisma.question.deleteMany({ where: { testId: CROSS_ORG.testId } });
  await prisma.question.create({
    data: {
      testId: CROSS_ORG.testId,
      text: 'Patří tento test do jiné organizace?',
      type: QuestionType.TRUE_FALSE,
      order: 1,
      score: 1,
      correctAnswer: 'true',
      correctAnswers: [],
    },
  });

  // 4) OPEN assignment in org B (CLASS target → the enrolled org-B student is included).
  await prisma.assignment.upsert({
    where: { id: CROSS_ORG.assignmentId },
    update: {
      organizationId: orgId,
      yearId: CROSS_ORG.academicYearId,
      testId: CROSS_ORG.testId,
      targetType: 'CLASS',
      classSectionId: CROSS_ORG.classSectionId,
      openAt: OPEN_AT,
      closeAt: CLOSE_AT,
      maxAttempts: 3,
      shuffle: false,
      showExplain: 'after_close',
      createdById: teacherMembershipId,
    },
    create: {
      id: CROSS_ORG.assignmentId,
      organizationId: orgId,
      yearId: CROSS_ORG.academicYearId,
      testId: CROSS_ORG.testId,
      targetType: 'CLASS',
      classSectionId: CROSS_ORG.classSectionId,
      openAt: OPEN_AT,
      closeAt: CLOSE_AT,
      maxAttempts: 3,
      shuffle: false,
      showExplain: 'after_close',
      createdById: teacherMembershipId,
    },
  });

  logDone('Cross-org foreign assignment ready');
}
