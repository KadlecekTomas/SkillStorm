/**
 * E2E: Student GET /tests — Visibility via assignment + enrollment
 *
 * Core invariants:
 *   1. Student with active enrollment and an open class assignment → 200 with items.length > 0
 *   2. Student with no enrollment / no active assignment → 200 with items = []  (NOT 403)
 *   3. Teacher's test that is not assigned to the student's class → NOT in student result
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { $Enums } from '@prisma/client';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext, login } from 'test/helpers';

describe('Student GET /tests visibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let academicYearId: string;
  let classSectionId: string;

  let teacherMembershipId: string;
  let studentMembershipId: string;
  let studentToken: string;
  let unenrolledStudentToken: string;

  let publishedTestId: string;
  let activeAssignmentId: string;
  let unenrolledStudentMembershipId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    // 1. Bootstrap org with director + teacher + two students
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `stv_${Date.now()}`,
      with: { teacher: true, student: true },
    });

    orgId = ctx.organization.id;
    teacherMembershipId = ctx.teacher!.membership.id;
    studentMembershipId = ctx.student!.membership.id;

    // Login enrolled student scoped to this org
    studentToken = await login(app, {
      ...ctx.student!.login,
      organizationId: orgId,
    });

    // Add a second student that will remain unenrolled
    const unenrolled = await ctx.addMember(
      $Enums.OrganizationRole.STUDENT,
      `unenrolled_${Date.now()}`,
    );
    unenrolledStudentMembershipId = unenrolled.membership.id;
    unenrolledStudentToken = await login(app, {
      ...unenrolled.login,
      organizationId: orgId,
    });

    // 2. Create current academic year
    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: `STV_${Date.now()}`,
        startsAt: new Date('2024-09-01'),
        endsAt: new Date('2025-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    academicYearId = year.id;

    // 3. Create class section
    const cls = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'A',
      },
      select: { id: true },
    });
    classSectionId = cls.id;

    // 4. Create Student domain entity and ACTIVE enrollment for the enrolled student
    const studentRecord = await prisma.student.create({
      data: { membershipId: studentMembershipId, orgId },
      select: { id: true },
    });

    await prisma.enrollment.create({
      data: {
        studentId: studentRecord.id,
        classSectionId,
        yearId: academicYearId,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });

    // 5. Create published test
    const testEntity = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Student Visibility E2E Test',
        creatorId: teacherMembershipId,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    publishedTestId = testEntity.id;

    await prisma.question.create({
      data: {
        testId: publishedTestId,
        text: 'Is 1 < 2?',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
    });

    // 6. Assign test to the class (window open now)
    const now = Date.now();
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId: publishedTestId,
        targetType: 'CLASS',
        classSectionId,
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 3,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
      },
      select: { id: true },
    });
    activeAssignmentId = assignment.id;
  });

  afterAll(async () => {
    await prisma.assignment
      .deleteMany({ where: { id: activeAssignmentId } })
      .catch(() => {});
    await prisma.question.deleteMany({ where: { testId: publishedTestId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: publishedTestId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { yearId: academicYearId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { yearId: academicYearId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
    await prisma.membership
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});

    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Enrolled student with active class assignment
  // ---------------------------------------------------------------------------

  it('GET /tests → 200 for authenticated student (not 403)', async () => {
    await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('GET /tests → items.length > 0 for student with active class assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: unknown[] = res.body?.items ?? res.body?.data?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
  });

  it('GET /tests → response includes the assigned test', async () => {
    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<{ id: string }> =
      res.body?.items ?? res.body?.data?.items ?? [];
    const ids = items.map((t) => t.id);
    expect(ids).toContain(publishedTestId);
  });

  // ---------------------------------------------------------------------------
  // 2. Student without enrollment → 200 empty list (never 403)
  // ---------------------------------------------------------------------------

  it('GET /tests → 200 (not 403) for student with no enrollment', async () => {
    await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${unenrolledStudentToken}`)
      .expect(200);
  });

  it('GET /tests → empty items for student with no enrollment', async () => {
    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${unenrolledStudentToken}`)
      .expect(200);

    const items: unknown[] = res.body?.items ?? res.body?.data?.items ?? [];
    expect(items).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Enrolled student cannot see tests from other (unassigned) classes
  // ---------------------------------------------------------------------------

  it('GET /tests → does not include tests assigned only to other classes', async () => {
    // Create a separate class + test + assignment not visible to the enrolled student
    const otherCls = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'B',
      },
      select: { id: true },
    });

    const otherTest = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Other Class Test',
        creatorId: teacherMembershipId,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    const now = Date.now();
    const otherAssignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId: otherTest.id,
        targetType: 'CLASS',
        classSectionId: otherCls.id,
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
      },
      select: { id: true },
    });

    try {
      const res = await request(app.getHttpServer())
        .get('/tests')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const items: Array<{ id: string }> =
        res.body?.items ?? res.body?.data?.items ?? [];
      const ids = items.map((t) => t.id);
      expect(ids).not.toContain(otherTest.id);
    } finally {
      await prisma.assignment.deleteMany({ where: { id: otherAssignment.id } }).catch(() => {});
      await prisma.question.deleteMany({ where: { testId: otherTest.id } }).catch(() => {});
      await prisma.test.deleteMany({ where: { id: otherTest.id } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: otherCls.id } }).catch(() => {});
    }
  });
});
