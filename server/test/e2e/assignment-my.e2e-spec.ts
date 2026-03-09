/**
 * E2E: GET /assignments/my — Student visibility via enrollment
 *
 * Tests L-O: definitive student assignment visibility contract.
 *
 * L — happy path: enrolled student sees their assignment, effectiveStatus OPEN/UPCOMING
 * M — wrong class: student enrolled in classB cannot see assignment for classA
 * N — year mismatch: student enrolled in year 2025, test anchored to year 2024 → []
 * O — cross-org isolation: orgB student cannot see orgA assignments
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { $Enums, OrganizationStatus } from '@prisma/client';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext, login } from 'test/helpers';

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

async function buildOrgWithEnrolledStudent(
  app: INestApplication,
  prisma: PrismaService,
  seed: string,
) {
  const ctx = await setupOrgContext(app, prisma, {
    role: 'DIRECTOR',
    seed,
    with: { teacher: true, student: true },
  });

  const orgId = ctx.organization.id;
  const teacherMembershipId = ctx.teacher!.membership.id;
  const studentMembershipId = ctx.student!.membership.id;

  // Activate the org — orgs start as PENDING and the ApplicationReadinessGuard blocks PENDING orgs.
  await prisma.organization.update({
    where: { id: orgId },
    data: { status: OrganizationStatus.ACTIVE },
  });

  const studentToken = await login(app, {
    ...ctx.student!.login,
    organizationId: orgId,
  });

  // Re-use the default isCurrent year created by the org bootstrap.
  // Creating another isCurrent=true year for the same org violates the
  // partial unique index "academic_years_one_current_per_org".
  const year = await prisma.academicYear.findFirstOrThrow({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });

  const classA = await prisma.classSection.create({
    data: { orgId, yearId: year.id, grade: $Enums.SchoolGrade.GRADE_6, section: 'A' },
    select: { id: true },
  });

  const studentRecord = await prisma.student.create({
    data: { membershipId: studentMembershipId, orgId },
    select: { id: true },
  });

  await prisma.enrollment.create({
    data: {
      studentId: studentRecord.id,
      classSectionId: classA.id,
      yearId: year.id,
      orgId,
      status: $Enums.EnrollmentStatus.ACTIVE,
    },
  });

  const testEntity = await prisma.test.create({
    data: {
      organizationId: orgId,
      academicYearId: year.id,
      title: `${seed} Test`,
      creatorId: teacherMembershipId,
      status: $Enums.PublishStatus.PUBLISHED,
    },
    select: { id: true },
  });

  await prisma.question.create({
    data: {
      testId: testEntity.id,
      text: 'Q1',
      type: $Enums.QuestionType.TRUE_FALSE,
      correctAnswer: 'true',
      order: 1,
    },
  });

  return {
    orgId,
    yearId: year.id,
    classSectionId: classA.id,
    teacherMembershipId,
    studentMembershipId,
    studentToken,
    testId: testEntity.id,
    ctx,
  };
}

async function cleanupOrg(prisma: PrismaService, orgId: string, yearId: string) {
  await prisma.submission.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.assignmentStudent.deleteMany({
    where: { assignment: { organizationId: orgId } },
  }).catch(() => {});
  await prisma.assignment.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.question.deleteMany({ where: { test: { organizationId: orgId } } }).catch(() => {});
  await prisma.test.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.enrollment.deleteMany({ where: { yearId } }).catch(() => {});
  await prisma.classSection.deleteMany({ where: { yearId } }).catch(() => {});
  await prisma.student.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.academicYear.deleteMany({ where: { id: yearId } }).catch(() => {});
  await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Test L — Happy path
// ---------------------------------------------------------------------------

describe('L: GET /assignments/my — enrolled student sees assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let yearId: string;
  let studentToken: string;
  let assignmentId: string;
  let testId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const seed = `my_L_${Date.now()}`;
    const ctx = await buildOrgWithEnrolledStudent(app, prisma, seed);
    orgId = ctx.orgId;
    yearId = ctx.yearId;
    studentToken = ctx.studentToken;
    testId = ctx.testId;

    const now = Date.now();
    const a = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId,
        targetType: 'CLASS',
        classSectionId: ctx.classSectionId,
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 3,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.teacherMembershipId,
      },
      select: { id: true },
    });
    assignmentId = a.id;
  });

  afterAll(async () => {
    await cleanupOrg(prisma, orgId, yearId);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /assignments/my → 200', async () => {
    await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('response includes the assigned assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<{ id: string; testId: string; effectiveStatus: string }> =
      res.body?.data ?? res.body;
    const ids = (Array.isArray(items) ? items : []).map((a) => a.id);
    expect(ids).toContain(assignmentId);
  });

  it('assignment has effectiveStatus OPEN (window is currently open)', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<{ id: string; effectiveStatus: string }> =
      res.body?.data ?? res.body;
    const found = (Array.isArray(items) ? items : []).find((a) => a.id === assignmentId);
    expect(found).toBeDefined();
    expect(found!.effectiveStatus).toBe('OPEN');
  });

  it('assignment dto has expected shape (effectiveStatus, openAt, closeAt, maxAttempts)', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<Record<string, unknown>> = res.body?.data ?? res.body;
    const found = (Array.isArray(items) ? items : []).find((a) => a['id'] === assignmentId);
    expect(found).toMatchObject({
      testId,
      maxAttempts: 3,
      attemptsUsed: 0,
      effectiveStatus: 'OPEN',
    });
    expect(found).toHaveProperty('openAt');
    expect(found).toHaveProperty('closeAt');
  });
});

// ---------------------------------------------------------------------------
// Test M — Wrong class: student enrolled in classB, assignment targets classA
// ---------------------------------------------------------------------------

describe('M: GET /assignments/my — student NOT enrolled in target class sees [] (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let yearId: string;
  let studentBToken: string;
  let assignmentForClassAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const seed = `my_M_${Date.now()}`;
    const ctx = await buildOrgWithEnrolledStudent(app, prisma, seed);
    orgId = ctx.orgId;
    yearId = ctx.yearId;
    // ctx.studentToken is enrolled in classA

    // Create classB
    const classB = await prisma.classSection.create({
      data: { orgId, yearId, grade: $Enums.SchoolGrade.GRADE_6, section: 'B' },
      select: { id: true },
    });

    // Add studentB and enroll them in classB
    const memberB = await ctx.ctx.addMember($Enums.OrganizationRole.STUDENT, `mb_${seed}`);
    const studentBRecord = await prisma.student.create({
      data: { membershipId: memberB.membership.id, orgId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentBRecord.id,
        classSectionId: classB.id,
        yearId,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });

    studentBToken = await login(app, { ...memberB.login, organizationId: orgId });

    // Assign the test to classA only
    const now = Date.now();
    const a = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId: ctx.testId,
        targetType: 'CLASS',
        classSectionId: ctx.classSectionId, // classA
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.teacherMembershipId,
      },
      select: { id: true },
    });
    assignmentForClassAId = a.id;
  });

  afterAll(async () => {
    await cleanupOrg(prisma, orgId, yearId);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /assignments/my → 200', async () => {
    await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentBToken}`)
      .expect(200);
  });

  it('student enrolled in classB does NOT see assignment targeting classA', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentBToken}`)
      .expect(200);

    const items: Array<{ id: string }> = res.body?.data ?? res.body;
    const ids = (Array.isArray(items) ? items : []).map((a) => a.id);
    expect(ids).not.toContain(assignmentForClassAId);
  });

  it('student enrolled in classB sees empty list', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentBToken}`)
      .expect(200);

    const items: unknown[] = res.body?.data ?? res.body;
    expect(Array.isArray(items) ? items : []).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test N — Year mismatch: student enrolled in year2025, test anchored to year2024
// ---------------------------------------------------------------------------

describe('N: GET /assignments/my — year mismatch → student sees [] (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let year2025Id: string;
  let studentToken: string;
  let crossYearAssignmentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const seed = `my_N_${Date.now()}`;
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed,
      with: { teacher: true, student: true },
    });
    orgId = ctx.organization.id;
    const teacherMembershipId = ctx.teacher!.membership.id;
    const studentMembershipId = ctx.student!.membership.id;

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    studentToken = await login(app, { ...ctx.student!.login, organizationId: orgId });

    // The org bootstrap already created one isCurrent=true year. Reuse it as year2025.
    const year2025 = await prisma.academicYear.findFirstOrThrow({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    year2025Id = year2025.id;

    // Create a separate past year (isCurrent=false) — no constraint conflict.
    const year2024 = await prisma.academicYear.create({
      data: { orgId, label: `${seed}_2024`, startsAt: new Date('2023-09-01'), endsAt: new Date('2024-08-31'), isCurrent: false },
      select: { id: true },
    });

    // Class section in year 2024
    const class2024 = await prisma.classSection.create({
      data: { orgId, yearId: year2024.id, grade: $Enums.SchoolGrade.GRADE_6, section: 'A' },
      select: { id: true },
    });

    // Class section in year 2025 (student is enrolled here)
    const class2025 = await prisma.classSection.create({
      data: { orgId, yearId: year2025.id, grade: $Enums.SchoolGrade.GRADE_6, section: 'A' },
      select: { id: true },
    });

    const studentRecord = await prisma.student.create({
      data: { membershipId: studentMembershipId, orgId },
      select: { id: true },
    });

    // Enroll student only in year 2025
    await prisma.enrollment.create({
      data: {
        studentId: studentRecord.id,
        classSectionId: class2025.id,
        yearId: year2025.id,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });

    // Test anchored to year 2024
    const test2024 = await prisma.test.create({
      data: {
        organizationId: orgId,
        academicYearId: year2024.id,
        title: `${seed} Old Test`,
        creatorId: teacherMembershipId,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    await prisma.question.create({
      data: {
        testId: test2024.id,
        text: 'Q1',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
    });

    // Assignment in year 2024, targeting class2024
    const now = Date.now();
    const a = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year2024.id,
        testId: test2024.id,
        targetType: 'CLASS',
        classSectionId: class2024.id,
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: teacherMembershipId,
      },
      select: { id: true },
    });
    crossYearAssignmentId = a.id;
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.assignmentStudent.deleteMany({ where: { assignment: { organizationId: orgId } } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.question.deleteMany({ where: { test: { organizationId: orgId } } }).catch(() => {});
    await prisma.test.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /assignments/my → 200 (never 403)', async () => {
    await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('year 2024 assignment is NOT visible to student enrolled in year 2025', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<{ id: string }> = res.body?.data ?? res.body;
    const ids = (Array.isArray(items) ? items : []).map((a) => a.id);
    expect(ids).not.toContain(crossYearAssignmentId);
  });

  it('student enrolled in 2025 sees empty list when only 2024 assignments exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: unknown[] = res.body?.data ?? res.body;
    expect(Array.isArray(items) ? items : []).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test O — Cross-org isolation: orgB student cannot see orgA assignments
// ---------------------------------------------------------------------------

describe('O: GET /assignments/my — cross-org isolation → student sees [] (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgAId: string;
  let orgBId: string;
  let yearAId: string;
  let yearBId: string;
  let orgBStudentToken: string;
  let orgAAssignmentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const seedA = `my_OA_${Date.now()}`;
    const seedB = `my_OB_${Date.now()}`;

    // ---- Org A setup ----
    const ctxA = await buildOrgWithEnrolledStudent(app, prisma, seedA);
    orgAId = ctxA.orgId;
    yearAId = ctxA.yearId;

    const nowA = Date.now();
    const a = await prisma.assignment.create({
      data: {
        organizationId: orgAId,
        yearId: yearAId,
        testId: ctxA.testId,
        targetType: 'CLASS',
        classSectionId: ctxA.classSectionId,
        openAt: new Date(nowA - 60_000),
        closeAt: new Date(nowA + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctxA.teacherMembershipId,
      },
      select: { id: true },
    });
    orgAAssignmentId = a.id;

    // ---- Org B setup ----
    const ctxB = await buildOrgWithEnrolledStudent(app, prisma, seedB);
    orgBId = ctxB.orgId;
    yearBId = ctxB.yearId;
    // Login orgB student scoped to orgB
    orgBStudentToken = ctxB.studentToken;
  });

  afterAll(async () => {
    await cleanupOrg(prisma, orgAId, yearAId);
    await cleanupOrg(prisma, orgBId, yearBId);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /assignments/my → 200 for orgB student', async () => {
    await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${orgBStudentToken}`)
      .expect(200);
  });

  it('orgB student cannot see orgA assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${orgBStudentToken}`)
      .expect(200);

    const items: Array<{ id: string }> = res.body?.data ?? res.body;
    const ids = (Array.isArray(items) ? items : []).map((a) => a.id);
    expect(ids).not.toContain(orgAAssignmentId);
  });
});

// ---------------------------------------------------------------------------
// Test P — Direct student targeting: assignment with targetType=STUDENTS
// ---------------------------------------------------------------------------

describe('P: GET /assignments/my — direct student assignment is visible (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let yearId: string;
  let studentToken: string;
  let studentMembershipId: string;
  let assignmentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const seed = `my_P_${Date.now()}`;
    const ctx = await buildOrgWithEnrolledStudent(app, prisma, seed);
    orgId = ctx.orgId;
    yearId = ctx.yearId;
    studentToken = ctx.studentToken;
    studentMembershipId = ctx.studentMembershipId;

    const now = Date.now();
    const directAssignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId: ctx.testId,
        targetType: 'STUDENTS',
        openAt: new Date(now - 60_000),
        closeAt: new Date(now + 3_600_000),
        maxAttempts: 2,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.teacherMembershipId,
        students: {
          create: [{ studentId: studentMembershipId }],
        },
      },
      select: { id: true },
    });
    assignmentId = directAssignment.id;
  });

  afterAll(async () => {
    await cleanupOrg(prisma, orgId, yearId);
    await prisma.$disconnect();
    await app.close();
  });

  it('student sees directly assigned assignment in /assignments/my', async () => {
    const res = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const items: Array<{ id: string; effectiveStatus: string }> = res.body?.data ?? res.body;
    const directAssignment = (Array.isArray(items) ? items : []).find((a) => a.id === assignmentId);
    expect(directAssignment).toBeDefined();
    expect(directAssignment?.effectiveStatus).toBe('OPEN');
  });
});
