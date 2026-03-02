/**
 * E2E: Assignment Visibility — Enrollment as Source of Truth
 *
 * Validates that /assignments/overview correctly buckets assignments
 * using ONLY Enrollment (ACTIVE + current academic year) as the targeting source.
 *
 * Core invariant:
 *   Student enrolled in class → class assignment is visible
 *   Student NOT enrolled → class assignment is NOT visible
 *   Student directly targeted → assignment is visible
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { $Enums, OrganizationRole } from '@prisma/client';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext, login } from 'test/helpers';

describe('Assignment Visibility (enrollment source of truth) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // org context
  let orgId: string;
  let academicYearId: string;
  let classSectionId: string;

  // actors
  let directorToken: string;
  let studentToken: string;
  let studentMembershipId: string;
  let teacherMembershipId: string;

  // test entity
  let testId: string;

  // assignments
  let activeClassAssignmentId: string;
  let directStudentAssignmentId: string;
  let upcomingClassAssignmentId: string;
  let closedClassAssignmentId: string;
  let otherClassAssignmentId: string; // student not enrolled in this class

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

    // 1. Bootstrap org with director + teacher + student
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `visibility_${Date.now()}`,
      with: { teacher: true, student: true },
    });

    orgId = ctx.organization.id;
    directorToken = ctx.owner.accessToken;
    teacherMembershipId = ctx.teacher!.membership.id;
    studentMembershipId = ctx.student!.membership.id;

    // Login student scoped to this org
    studentToken = await login(app, {
      ...ctx.student!.login,
      organizationId: orgId,
    });

    // 2. Create current academic year
    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: `VIS_${Date.now()}`,
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
        grade: $Enums.SchoolGrade.GRADE_6,
        section: 'A',
      },
      select: { id: true },
    });
    classSectionId = cls.id;

    // 4. Create Student record (domain entity) for the student membership
    const studentRecord = await prisma.student.create({
      data: {
        membershipId: studentMembershipId,
        orgId,
      },
      select: { id: true },
    });

    // 5. Create ACTIVE enrollment for current year
    await prisma.enrollment.create({
      data: {
        studentId: studentRecord.id,
        classSectionId,
        yearId: academicYearId,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });

    // 6. Create a published test with one question
    const testEntity = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Visibility E2E Test',
        creatorId: teacherMembershipId,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    testId = testEntity.id;
    await prisma.question.create({
      data: {
        testId,
        text: 'Is 2 > 1?',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
    });

    const now = Date.now();

    // 7a. ACTIVE class assignment (open now)
    const activeClassA = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId,
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
    activeClassAssignmentId = activeClassA.id;

    // 7b. ACTIVE direct assignment (targetType=STUDENTS)
    const directA = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS',
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });
    directStudentAssignmentId = directA.id;

    // 7c. UPCOMING class assignment (not yet open)
    const upcomingA = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId,
        targetType: 'CLASS',
        classSectionId,
        openAt: new Date(now + 86_400_000), // tomorrow
        closeAt: new Date(now + 2 * 86_400_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
      },
      select: { id: true },
    });
    upcomingClassAssignmentId = upcomingA.id;

    // 7d. CLOSED class assignment (window already closed)
    const closedA = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId,
        targetType: 'CLASS',
        classSectionId,
        openAt: new Date(now - 7_200_000), // 2h ago
        closeAt: new Date(now - 3_600_000), // 1h ago
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
      },
      select: { id: true },
    });
    closedClassAssignmentId = closedA.id;

    // 7e. Class assignment for a DIFFERENT class (student NOT enrolled)
    const otherCls = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_6,
        section: 'B',
      },
      select: { id: true },
    });
    const otherClassA = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: academicYearId,
        testId,
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
    otherClassAssignmentId = otherClassA.id;
  });

  afterAll(async () => {
    const assignmentIds = [
      activeClassAssignmentId,
      directStudentAssignmentId,
      upcomingClassAssignmentId,
      closedClassAssignmentId,
      otherClassAssignmentId,
    ].filter(Boolean);

    await prisma.assignmentStudent
      .deleteMany({ where: { assignmentId: { in: assignmentIds } } })
      .catch(() => {});
    await prisma.assignment
      .deleteMany({ where: { id: { in: assignmentIds } } })
      .catch(() => {});
    await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: testId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { yearId: academicYearId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { yearId: academicYearId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});

    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // CORE VISIBILITY INVARIANT
  // ---------------------------------------------------------------------------

  it('GET /assignments/overview → 200 for authenticated student', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('now');
    expect(res.body.data).toHaveProperty('active');
    expect(res.body.data).toHaveProperty('upcoming');
    expect(res.body.data).toHaveProperty('closedUnsubmitted');
    expect(res.body.data).toHaveProperty('completed');
  });

  it('active bucket contains CLASS assignment for enrolled student', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const overview = res.body.data;
    const activeIds = overview.active.map((a: any) => a.assignmentId);
    expect(activeIds).toContain(activeClassAssignmentId);
  });

  it('active bucket contains STUDENTS direct assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const overview = res.body.data;
    const activeIds = overview.active.map((a: any) => a.assignmentId);
    expect(activeIds).toContain(directStudentAssignmentId);
  });

  it('active.length === 2 (CLASS + direct student assignment)', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const overview = res.body.data;
    expect(overview.active).toHaveLength(2);
  });

  it('upcoming bucket contains future CLASS assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const upcomingIds = res.body.data.upcoming.map((a: any) => a.assignmentId);
    expect(upcomingIds).toContain(upcomingClassAssignmentId);
  });

  it('closedUnsubmitted bucket contains closed assignment with no submission', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const closedIds = res.body.data.closedUnsubmitted.map((a: any) => a.assignmentId);
    expect(closedIds).toContain(closedClassAssignmentId);
  });

  it('assignment for class student is NOT enrolled in is NOT visible', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const overview = res.body.data;
    const allIds = [
      ...overview.active,
      ...overview.upcoming,
      ...overview.closedUnsubmitted,
      ...overview.completed,
    ].map((a: any) => a.assignmentId);

    expect(allIds).not.toContain(otherClassAssignmentId);
  });

  it('overview items include title, openAt, closeAt, remainingAttempts, attemptsUsed', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const item = res.body.data.active[0];
    expect(item).toHaveProperty('assignmentId');
    expect(item).toHaveProperty('testId');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('openAt');
    expect(item).toHaveProperty('closeAt');
    expect(item).toHaveProperty('maxAttempts');
    expect(item).toHaveProperty('remainingAttempts');
    expect(item).toHaveProperty('attemptsUsed');
    expect(item.attemptsUsed).toBe(0);
    expect(item.title).toBe('Visibility E2E Test');
  });

  // ---------------------------------------------------------------------------
  // ENROLLMENT REMOVAL: student unenrolled → class assignment disappears
  // ---------------------------------------------------------------------------

  it('class assignment disappears from active when student enrollment is removed', async () => {
    // Remove the enrollment
    await prisma.enrollment.updateMany({
      where: {
        classSectionId,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
      data: { status: $Enums.EnrollmentStatus.LEFT },
    });

    const res = await request(app.getHttpServer())
      .get('/assignments/overview')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const overview = res.body.data;
    const activeIds = overview.active.map((a: any) => a.assignmentId);

    // Class assignment should no longer be visible
    expect(activeIds).not.toContain(activeClassAssignmentId);
    // Direct assignment is still visible (not class-based)
    expect(activeIds).toContain(directStudentAssignmentId);

    // Restore enrollment for other tests in suite (if any)
    await prisma.enrollment.updateMany({
      where: {
        classSectionId,
        orgId,
        status: $Enums.EnrollmentStatus.LEFT,
      },
      data: { status: $Enums.EnrollmentStatus.ACTIVE },
    });
  });

  // ---------------------------------------------------------------------------
  // PART 2: Assignment creation guard — empty class
  // ---------------------------------------------------------------------------

  it('POST /assignments → 400 when class has no ACTIVE enrolled students', async () => {
    // Create a class section with zero enrollments
    const emptyClass = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'Z',
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        testId,
        targetType: 'CLASS',
        classSectionId: emptyClass.id,
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 3_600_000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
      })
      .expect(400);

    expect(res.body?.message ?? res.body?.error ?? JSON.stringify(res.body)).toMatch(
      /no.*enrolled|CLASS_HAS_NO_ENROLLED_STUDENTS/i,
    );

    await prisma.classSection.delete({ where: { id: emptyClass.id } }).catch(() => {});
  });

  it('POST /assignments → 201 when class has at least one ACTIVE enrolled student', async () => {
    // classSectionId already has an ACTIVE enrollment from beforeAll
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        testId,
        targetType: 'CLASS',
        classSectionId,
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 3_600_000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
      })
      .expect(201);

    expect(res.body?.data?.id ?? res.body?.id).toBeTruthy();

    // Cleanup
    const id = res.body?.data?.id ?? res.body?.id;
    if (id) {
      await prisma.assignment.delete({ where: { id } }).catch(() => {});
    }
  });
});
