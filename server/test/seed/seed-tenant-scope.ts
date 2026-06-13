import { INestApplication } from '@nestjs/common';
import {
  EnrollmentStatus,
  OrganizationStatus,
  OrganizationRole,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import { bootstrapOrg } from 'test/e2e/helpers/bootstrap-org';

type ActorSeed = {
  token: string;
  membershipId: string;
  studentId?: string;
  userId: string;
};

export type TenantScopeSeedResult = {
  orgA: {
    id: string;
    activeAcademicYearId: string;
    classSectionId: string;
    teacher: ActorSeed;
    director: ActorSeed;
    student: ActorSeed;
    subjectId: string;
    catalogTopicId: string;
    testId: string;
    assignmentId: string;
    submissionId: string;
  };
  orgB: {
    id: string;
    activeAcademicYearId: string;
    classSectionId: string;
    teacher: ActorSeed;
    director: ActorSeed;
    student: ActorSeed;
    subjectId: string;
    catalogTopicId: string;
    testId: string;
    assignmentId: string;
    submissionId: string;
  };
};

async function ensureActiveYear(
  prisma: PrismaService,
  orgId: string,
  label: string,
  startsAt: Date,
  endsAt: Date,
): Promise<string> {
  await prisma.academicYear.updateMany({
    where: { orgId, isCurrent: true },
    data: { isCurrent: false },
  });
  const year = await prisma.academicYear.upsert({
    where: { orgId_label: { orgId, label } },
    update: { startsAt, endsAt, isCurrent: true },
    create: { orgId, label, startsAt, endsAt, isCurrent: true },
    select: { id: true },
  });
  return year.id;
}

async function ensureSubjectTopic(
  prisma: PrismaService,
  orgId: string,
  grade: SchoolGrade,
): Promise<{ subjectId: string; catalogTopicId: string; topicLevelId: string }> {
  const catalogSubject = await prisma.catalogSubject.upsert({
    where: { code: 'TENANT-RBAC-MATH' },
    update: { isActive: true, deletedAt: null },
    create: { code: 'TENANT-RBAC-MATH', name: 'Tenant RBAC Math' },
    select: { id: true },
  });

  const subject = await prisma.subject.upsert({
    where: { catalogSubjectId: catalogSubject.id },
    update: { deletedAt: null, gradeFrom: 1, gradeTo: 9 },
    create: {
      catalogSubjectId: catalogSubject.id,
      name: 'Tenant RBAC Math',
      gradeFrom: 1,
      gradeTo: 9,
    },
    select: { id: true },
  });

  await prisma.orgSubject.upsert({
    where: {
      organizationId_subjectId: {
        organizationId: orgId,
        subjectId: subject.id,
      },
    },
    update: { isEnabled: true },
    create: {
      organizationId: orgId,
      subjectId: subject.id,
      isEnabled: true,
      isCustom: false,
    },
  });

  const subjectLevel = await prisma.subjectLevel.upsert({
    where: {
      subjectId_grade: {
        subjectId: subject.id,
        grade,
      },
    },
    update: { isEnabled: true },
    create: {
      subjectId: subject.id,
      grade,
      label: `${grade} tenant RBAC`,
      isEnabled: true,
    },
    select: { id: true },
  });

  const catalogTopic = await prisma.catalogTopic.upsert({
    where: {
      subjectId_name: {
        subjectId: catalogSubject.id,
        name: 'Tenant RBAC Topic',
      },
    },
    update: { isActive: true, deletedAt: null },
    create: {
      subjectId: catalogSubject.id,
      name: 'Tenant RBAC Topic',
      order: 1,
    },
    select: { id: true },
  });

  const topicLevel = await prisma.topicLevel.upsert({
    where: {
      subjectLevelId_catalogTopicId_phase: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
        phase: 'INTRO',
      },
    },
    update: {},
    create: {
      subjectLevelId: subjectLevel.id,
      catalogTopicId: catalogTopic.id,
      name: 'Tenant RBAC Topic',
      phase: 'INTRO',
    },
    select: { id: true },
  });

  return { subjectId: subject.id, catalogTopicId: catalogTopic.id, topicLevelId: topicLevel.id };
}

export async function seedTenantScope(
  app: INestApplication,
  prisma: PrismaService,
): Promise<TenantScopeSeedResult> {
  const ctxA = await setupOrgContext(app, prisma, {
    role: 'TEACHER',
    seed: `tenant_scope_A_${Date.now()}`,
    with: { director: true, student: true },
  });
  const ctxB = await setupOrgContext(app, prisma, {
    role: 'TEACHER',
    seed: `tenant_scope_B_${Date.now()}`,
    with: { director: true, student: true },
  });

  const orgAId = ctxA.organization.id as string;
  const orgBId = ctxB.organization.id as string;
  await prisma.organization.update({
    where: { id: orgAId },
    data: { status: OrganizationStatus.ACTIVE },
  });
  await prisma.organization.update({
    where: { id: orgBId },
    data: { status: OrganizationStatus.ACTIVE },
  });

  const orgAYearId = await ensureActiveYear(
    prisma,
    orgAId,
    '2025/2026',
    new Date('2025-09-01T00:00:00.000Z'),
    new Date('2026-08-31T23:59:59.999Z'),
  );
  const orgBYearId = await ensureActiveYear(
    prisma,
    orgBId,
    '2026/2027',
    new Date('2026-09-01T00:00:00.000Z'),
    new Date('2027-08-31T23:59:59.999Z'),
  );

  const bootA = await bootstrapOrg(prisma, {
    orgId: orgAId,
    startDate: new Date('2025-09-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T23:59:59.999Z'),
    label: '2025/2026',
    grade: SchoolGrade.GRADE_7,
    section: 'A',
    classLabel: '7.A',
  });
  const bootB = await bootstrapOrg(prisma, {
    orgId: orgBId,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2027-08-31T23:59:59.999Z'),
    label: '2026/2027',
    grade: SchoolGrade.GRADE_8,
    section: 'B',
    classLabel: '8.B',
  });

  await prisma.classSection.update({
    where: { id: bootA.classSectionId },
    data: { yearId: orgAYearId },
  });
  await prisma.classSection.update({
    where: { id: bootB.classSectionId },
    data: { yearId: orgBYearId },
  });

  const topicA = await ensureSubjectTopic(prisma, orgAId, SchoolGrade.GRADE_7);
  const topicB = await ensureSubjectTopic(prisma, orgBId, SchoolGrade.GRADE_8);

  const studentA = await prisma.student.upsert({
    where: { membershipId: ctxA.student!.membership.id },
    update: { orgId: orgAId, deletedAt: null },
    create: { membershipId: ctxA.student!.membership.id, orgId: orgAId },
    select: { id: true },
  });
  const studentB = await prisma.student.upsert({
    where: { membershipId: ctxB.student!.membership.id },
    update: { orgId: orgBId, deletedAt: null },
    create: { membershipId: ctxB.student!.membership.id, orgId: orgBId },
    select: { id: true },
  });

  await prisma.enrollment.createMany({
    data: [
      {
        studentId: studentA.id,
        classSectionId: bootA.classSectionId,
        yearId: orgAYearId,
        orgId: orgAId,
        status: EnrollmentStatus.ACTIVE,
      },
      {
        studentId: studentB.id,
        classSectionId: bootB.classSectionId,
        yearId: orgBYearId,
        orgId: orgBId,
        status: EnrollmentStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  const testA = await prisma.test.create({
    data: {
      organizationId: orgAId,
      subjectId: topicA.subjectId,
      academicYearId: orgAYearId,
      allowedGrades: [SchoolGrade.GRADE_7],
      title: 'Tenant Scope Test A',
      creatorId: ctxA.teacher!.membership.id,
      status: PublishStatus.PUBLISHED,
      questions: {
        create: [
          {
            text: 'A question',
            type: QuestionType.TRUE_FALSE,
            order: 1,
            correctAnswer: 'true',
            score: 1,
          },
        ],
      },
    },
    select: { id: true },
  });

  const testB = await prisma.test.create({
    data: {
      organizationId: orgBId,
      subjectId: topicB.subjectId,
      academicYearId: orgBYearId,
      allowedGrades: [SchoolGrade.GRADE_8],
      title: 'Tenant Scope Test B',
      creatorId: ctxB.teacher!.membership.id,
      status: PublishStatus.PUBLISHED,
      questions: {
        create: [
          {
            text: 'B question',
            type: QuestionType.TRUE_FALSE,
            order: 1,
            correctAnswer: 'false',
            score: 1,
          },
        ],
      },
    },
    select: { id: true },
  });

  await prisma.testAssignment.createMany({
    data: [
      { testId: testA.id, topicLevelId: topicA.topicLevelId, isPrimary: true },
      { testId: testB.id, topicLevelId: topicB.topicLevelId, isPrimary: true },
    ],
    skipDuplicates: true,
  });

  const now = Date.now();
  const assignmentA = await prisma.assignment.create({
    data: {
      organizationId: orgAId,
      yearId: orgAYearId,
      testId: testA.id,
      targetType: 'STUDENTS',
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 3_600_000),
      maxAttempts: 2,
      shuffle: false,
      showExplain: 'after_close',
      createdById: ctxA.teacher!.membership.id,
      students: { create: [{ studentId: ctxA.student!.membership.id }] },
    },
    select: { id: true },
  });

  const assignmentB = await prisma.assignment.create({
    data: {
      organizationId: orgBId,
      yearId: orgBYearId,
      testId: testB.id,
      targetType: 'STUDENTS',
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 3_600_000),
      maxAttempts: 2,
      shuffle: false,
      showExplain: 'after_close',
      createdById: ctxB.teacher!.membership.id,
      students: { create: [{ studentId: ctxB.student!.membership.id }] },
    },
    select: { id: true },
  });

  const submissionA = await prisma.submission.create({
    data: {
      organizationId: orgAId,
      assignmentId: assignmentA.id,
      testId: testA.id,
      studentId: ctxA.student!.membership.id,
      attemptNo: 1,
      status: SubmissionStatus.APPROVED,
      score: 1,
      submittedAt: new Date(),
    },
    select: { id: true },
  });

  const submissionB = await prisma.submission.create({
    data: {
      organizationId: orgBId,
      assignmentId: assignmentB.id,
      testId: testB.id,
      studentId: ctxB.student!.membership.id,
      attemptNo: 1,
      status: SubmissionStatus.APPROVED,
      score: 1,
      submittedAt: new Date(),
    },
    select: { id: true },
  });

  return {
    orgA: {
      id: orgAId,
      activeAcademicYearId: orgAYearId,
      classSectionId: bootA.classSectionId,
      teacher: {
        token: ctxA.teacher!.accessToken,
        membershipId: ctxA.teacher!.membership.id,
        userId: ctxA.teacher!.user.id,
      },
      director: {
        token: ctxA.director!.accessToken,
        membershipId: ctxA.director!.membership.id,
        userId: ctxA.director!.user.id,
      },
      student: {
        token: ctxA.student!.accessToken,
        membershipId: ctxA.student!.membership.id,
        studentId: studentA.id,
        userId: ctxA.student!.user.id,
      },
      subjectId: topicA.subjectId,
      catalogTopicId: topicA.catalogTopicId,
      testId: testA.id,
      assignmentId: assignmentA.id,
      submissionId: submissionA.id,
    },
    orgB: {
      id: orgBId,
      activeAcademicYearId: orgBYearId,
      classSectionId: bootB.classSectionId,
      teacher: {
        token: ctxB.teacher!.accessToken,
        membershipId: ctxB.teacher!.membership.id,
        userId: ctxB.teacher!.user.id,
      },
      director: {
        token: ctxB.director!.accessToken,
        membershipId: ctxB.director!.membership.id,
        userId: ctxB.director!.user.id,
      },
      student: {
        token: ctxB.student!.accessToken,
        membershipId: ctxB.student!.membership.id,
        studentId: studentB.id,
        userId: ctxB.student!.user.id,
      },
      subjectId: topicB.subjectId,
      catalogTopicId: topicB.catalogTopicId,
      testId: testB.id,
      assignmentId: assignmentB.id,
      submissionId: submissionB.id,
    },
  };
}

export async function createTenantScopeSeed(
  app: INestApplication,
): Promise<TenantScopeSeedResult> {
  const prisma = app.get(PrismaService);
  return seedTenantScope(app, prisma);
}
