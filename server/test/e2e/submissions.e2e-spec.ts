// test/e2e/submissions.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { AppModule } from '@/app.module';
import {
  $Enums,
  PublishStatus,
  QuestionType,
  OrganizationRole,
  OrganizationType,
} from '@prisma/client';
import { authAs, login } from 'test/helpers';

function uniqueIp() {
  const rnd = () => Math.floor(Math.random() * 250) + 1;
  return `10.${rnd()}.${rnd()}.${rnd()}`;
}

/**
 * Delete an assignment together with its submissions/responses.
 * submissions_assignment_id_fkey is RESTRICT, so referencing rows must go first;
 * submittedAt is cleared to bypass the response-lock trigger.
 */
async function deleteAssignmentDeep(prisma: PrismaService, id: string) {
  await prisma.submission.updateMany({
    where: { assignmentId: id },
    data: { submittedAt: null },
  });
  await prisma.response.deleteMany({
    where: { submission: { assignmentId: id } },
  });
  await prisma.submission.deleteMany({ where: { assignmentId: id } });
  await prisma.assignment.delete({ where: { id } });
}

describe('Submissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const QT = QuestionType;
  const unique = Date.now();

  // --- actors
  let superUser: {
    id: string;
    token: string;
    login: { email: string; password: string };
  };

  const teacher = {
    name: 'E2E Teacher',
    email: `e2e.teacher.${unique}@example.com`,
    username: `e2e_teacher_${unique}`,
    password: 'Password123!',
  };
  const student = {
    name: 'E2E Student',
    email: `e2e.student.${unique}@example.com`,
    username: `e2e_student_${unique}`,
    password: 'Password123!',
  };
  const outsider = {
    name: 'E2E Outsider',
    email: `e2e.outsider.${unique}@example.com`,
    username: `e2e_outsider_${unique}`,
    password: 'Password123!',
  };

  // --- orgs & memberships
  let org: { id: string };
  let otherOrg: { id: string };

  let teacherMembershipId = '';
  let studentMembershipId = '';
  let outsiderMembershipId = '';

  // --- tokens
  let teacherToken = '';
  let studentToken = '';
  let outsiderToken = '';

  // --- test data
  let testId = '';
  let assignmentId = '';
  let closedAssignmentId = '';
  let futureAssignmentId = '';
  let academicYearId = '';
  let otherOrgAcademicYearId = '';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
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

    // SUPERADMIN (pro případnou globální kontrolu)
    const superAuth = await authAs(app, OrganizationRole.STUDENT, {
      seed: `super_${unique}`,
      name: 'E2E Super',
      email: `e2e.super.${unique}@example.com`,
      username: `e2e_super_${unique}`,
    });
    await prisma.user.update({
      where: { id: superAuth.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: superAuth.user.id,
      token: superAuth.accessToken,
      login: superAuth.login,
    };

    // Orgs (ACTIVE so execution flows like submissions are allowed)
    org = await prisma.organization.create({
      data: {
        name: `E2E Org ${unique}`,
        type: OrganizationType.SCHOOL,
        status: $Enums.OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });
    otherOrg = await prisma.organization.create({
      data: {
        name: `E2E Other Org ${unique}`,
        type: OrganizationType.SCHOOL,
        status: $Enums.OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });

    // Teacher + Student + Outsider users.
    // INDIVIDUAL registration mode was removed; mint standalone accounts via authAs
    // (CREATE_ORG under the hood) and attach the memberships we need manually below.
    const regTeacher = await authAs(app, OrganizationRole.TEACHER, {
      name: teacher.name,
      email: teacher.email,
      username: teacher.username,
      password: teacher.password,
    });
    const regStudent = await authAs(app, OrganizationRole.STUDENT, {
      name: student.name,
      email: student.email,
      username: student.username,
      password: student.password,
    });
    const regOutsider = await authAs(app, OrganizationRole.STUDENT, {
      name: outsider.name,
      email: outsider.email,
      username: outsider.username,
      password: outsider.password,
    });

    // Memberships
    const [mTeacher, mStudent, mOutsider] = await prisma.$transaction([
      prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: regTeacher.user.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      }),
      prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: regStudent.user.id,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
      prisma.membership.create({
        data: {
          organizationId: otherOrg.id,
          userId: regOutsider.user.id,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
    ]);

    teacherMembershipId = mTeacher.id;
    studentMembershipId = mStudent.id;
    outsiderMembershipId = mOutsider.id;

    // Logins — use the shared login helper which logs in scoped to an org and
    // returns the current access token shape (the old /auth/use-org two-step is gone).
    teacherToken = await login(app, {
      email: teacher.email,
      password: teacher.password,
      organizationId: org.id,
    });
    studentToken = await login(app, {
      email: student.email,
      password: student.password,
      organizationId: org.id,
    });
    outsiderToken = await login(app, {
      email: outsider.email,
      password: outsider.password,
      organizationId: otherOrg.id,
    });

    // Academic year (required for assignments)
    // Academic year window must contain "now" or submissions fail with YEAR_WINDOW_CLOSED.
    const yearStartsAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const yearEndsAt = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    const academicYear = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: `E2E ${unique}`,
        startsAt: yearStartsAt,
        endsAt: yearEndsAt,
        isCurrent: true,
      },
      select: { id: true },
    });
    academicYearId = academicYear.id;

    const otherYear = await prisma.academicYear.create({
      data: {
        orgId: otherOrg.id,
        label: `E2E Other ${unique}`,
        startsAt: yearStartsAt,
        endsAt: yearEndsAt,
        isCurrent: true,
      },
      select: { id: true },
    });
    otherOrgAcademicYearId = otherYear.id;

    // Org readiness (R2) requires a class section in the current year for both orgs.
    await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_5,
        section: `S${unique}`,
      },
    });
    await prisma.classSection.create({
      data: {
        orgId: otherOrg.id,
        yearId: otherOrgAcademicYearId,
        grade: $Enums.SchoolGrade.GRADE_5,
        section: `O${unique}`,
      },
    });

    // Test se 3 otázkami
    const createdTest = await prisma.test.create({
      data: {
        organizationId: org.id,
        title: `E2E Test ${unique}`,
        status: PublishStatus.PUBLISHED,
        creatorId: teacherMembershipId,
        questions: {
          create: [
            {
              text: 'Kolik je 2+2?',
              type: QT.FILL_IN_THE_BLANK,
              order: 1,
              score: 1,
              correctAnswer: '4',
            },
            {
              text: 'Je 1 < 2?',
              type: QT.TRUE_FALSE,
              order: 2,
              score: 1,
              correctAnswer: 'true',
            },
            {
              text: 'Hlavní město ČR?',
              type: QT.FILL_IN_THE_BLANK,
              order: 3,
              score: 1,
              correctAnswer: 'Praha',
            },
          ],
        },
      },
      select: { id: true },
    });
    testId = createdTest.id;

    // Assignment – otevřený teď a přiřazený student
    const now = new Date();
    const openAt = new Date(now.getTime() - 60_000);
    const closeAt = new Date(now.getTime() + 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt,
        closeAt,
        maxAttempts: 3,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });
    assignmentId = assignment.id;

    // Assignment – již uzavřený
    const closed = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(now.getTime() - 2 * 60_000),
        closeAt: new Date(now.getTime() - 60_000),
        maxAttempts: 2,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });
    closedAssignmentId = closed.id;

    // Assignment – ještě neotevřený
    const future = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(now.getTime() + 60_000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 2,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });
    futureAssignmentId = future.id;
  });

  afterAll(async () => {
    // best-effort cleanup — robust, org-scoped (handles temp assignments from tests too)
    try {
      for (const orgId of [org?.id, otherOrg?.id].filter(Boolean) as string[]) {
        await prisma.submission.updateMany({
          where: { organizationId: orgId },
          data: { submittedAt: null },
        });
        await prisma.response.deleteMany({
          where: { submission: { organizationId: orgId } },
        });
        await prisma.submission.deleteMany({ where: { organizationId: orgId } });
        await prisma.assignment.deleteMany({ where: { organizationId: orgId } });
        await prisma.question.deleteMany({
          where: { test: { organizationId: orgId } },
        });
        await prisma.test.deleteMany({ where: { organizationId: orgId } });
        await prisma.classSection.deleteMany({ where: { orgId } });
        await prisma.academicYear.deleteMany({ where: { orgId } });
        await prisma.membership.deleteMany({ where: { organizationId: orgId } });
        await prisma.organization.deleteMany({ where: { id: orgId } });
      }

      await prisma.refreshToken.deleteMany({
        where: { userId: { in: [superUser.id] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [superUser.id] } } });
    } catch {}
    await prisma.$disconnect();
    await app.close();
  });

  // ------------------------------------------------------------------
  // HAPPY FLOW
  // ------------------------------------------------------------------

  it('POST /submissions → 201, PATCH responses → 200, POST finish → 200 (+score≈1.0)', async () => {
    // create (201 or 200 if idempotent return)
    const createRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId });
    expect([200, 201]).toContain(createRes.status);
    const submissionId = createRes.body.id as string;
    expect(submissionId).toBeTruthy();

    // questions in order
    const qs = await prisma.question.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
      select: { id: true, correctAnswer: true },
    });
    const [q1, q2, q3] = qs;
    if (!q1 || !q2 || !q3) {
      throw new Error('Expected at least 3 questions for submission flow');
    }

    const responses = [
      { questionId: q1.id, givenText: '4' },
      { questionId: q2.id, givenText: 'true' },
      { questionId: q3.id, givenText: 'Praha' },
    ];

    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses })
      .expect(200);

    const finishRes = await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses })
      .expect(200);

    // status + score
    expect(['APPROVED', 'EVALUATED', 'FINISHED']).toContain(
      String(finishRes.body.status ?? '').toUpperCase(),
    );
    if (typeof finishRes.body.score === 'number') {
      expect(finishRes.body.score).toBeGreaterThan(0.9); // ~1.0
      expect(finishRes.body.score).toBeLessThanOrEqual(1.0);
    }

    const badgesRes = await request(app.getHttpServer())
      .get('/gamification/me/badges')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(Array.isArray(badgesRes.body?.data)).toBe(true);
    const badgeCodes = new Set(
      (badgesRes.body.data as Array<{ code?: string }>).map((item) => item.code),
    );
    expect(badgeCodes.has('FIRST_TEST_COMPLETED')).toBe(true);
    expect(badgeCodes.has('PERFECT_SCORE')).toBe(true);
  });

  // ------------------------------------------------------------------
  // RBAC & ACCESS
  // ------------------------------------------------------------------

  it('POST /submissions → 401 bez tokenu', async () => {
    await request(app.getHttpServer())
      .post('/submissions')
      .send({ assignmentId })
      .expect(401);
  });

  it('POST /submissions → 403 když student není přiřazen (outsider v jiné org)', async () => {
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ assignmentId });
    expect([403, 404]).toContain(res.status); // podle implementace
  });

  it('PATCH/finish jiné osoby → 403', async () => {
    // student vytvoří submission
    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId });
    expect([200, 201]).toContain(s.status);

    // teacher se pokusí měnit/ukončit
    const r1 = await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ responses: [] });
    expect([403, 404]).toContain(r1.status);

    const r2 = await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ responses: [] });
    expect([403, 404]).toContain(r2.status);
  });

  // ------------------------------------------------------------------
  // TIME WINDOWS & LIMITS
  // ------------------------------------------------------------------

  it('POST /submissions → 403 když assignment ještě nezačal (openAt v budoucnu)', async () => {
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: futureAssignmentId });
    expect([400, 403, 409]).toContain(res.status);
  });

  it('POST /submissions → 403/409 když assignment je po deadline', async () => {
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: closedAssignmentId });
    expect([400, 403, 409]).toContain(res.status);
  });

  it('POST /submissions → 409 po vyčerpání maxAttempts', async () => {
    // jednorázový assignment
    const now = new Date();
    const single = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(now.getTime() - 60_000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 1,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    // první OK (nebo 200 idempotent)
    const first = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: single.id });
    expect([200, 201]).toContain(first.status);

    // druhý už přes limit
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: single.id });

    expect([400, 403, 409]).toContain(res.status);

    await deleteAssignmentDeep(prisma, single.id);
  });

  it('POST /submissions/:id/finish → 403 po deadline i pro rozpracovanou submission', async () => {
    // otevřený assignment, brzy zavřeme
    const soon = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 5_000),
        maxAttempts: 1,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: soon.id });
    expect([200, 201]).toContain(s.status);

    // posuň deadline do minulosti
    await prisma.assignment.update({
      where: { id: soon.id },
      data: { closeAt: new Date(Date.now() - 1_000) },
    });

    const res = await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] });

    expect([403, 409]).toContain(res.status);

    await deleteAssignmentDeep(prisma, soon.id);
  });

  // ------------------------------------------------------------------
  // VALIDACE & EDGE-CASES
  // ------------------------------------------------------------------

  it('POST /submissions → 400 na nevalidní assignmentId', async () => {
    await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: 'not-a-uuid' })
      .expect(400);
  });

  it('PATCH /submissions/:id/responses → 404 na neexistující submission', async () => {
    // Non-empty responses so the service performs the submission lookup (an empty
    // responses array short-circuits to success before any lookup).
    await request(app.getHttpServer())
      .patch(`/submissions/${randomUUID()}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId: randomUUID(), givenText: 'x' }] })
      .expect(404);
  });

  it('PATCH /submissions/:id/responses → 400 na nevalidní questionId', async () => {
    // vytvoř submission
    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId });
    expect([200, 201]).toContain(s.status);

    await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId: 'not-uuid', givenText: 'x' }] })
      .expect(400);
  });

  it('concurrency: Promise.all([finish, finish]) → both 200, same payload, no duplicate scoring', async () => {
    const concurrAssignment = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 5,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    const createRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: concurrAssignment.id });
    expect([200, 201]).toContain(createRes.status);
    const submissionId = createRes.body.id as string;

    const qs = await prisma.question.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
      select: { id: true, correctAnswer: true },
    });
    const responses = qs.map((q) => ({
      questionId: q.id,
      givenText: q.correctAnswer ?? '',
    }));

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses }),
      request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.id).toBe(res2.body.id);
    expect(res1.body.status).toBe(res2.body.status);
    expect(res1.body.score).toBe(res2.body.score);
    expect(res1.body.submittedAt).toBeDefined();
    const count = await prisma.submission.count({
      where: { id: submissionId },
    });
    expect(count).toBe(1);
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true, score: true, submittedAt: true },
    });
    expect(sub?.status).toBe('APPROVED');
    expect(sub?.submittedAt).toBeTruthy();

    await deleteAssignmentDeep(prisma, concurrAssignment.id);
  });

  it('POST /submissions/:id/finish → idempotentní (druhé finish vrátí 200/409/400, ale nezmění výsledek)', async () => {
    const tmpAssignment = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 5,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: tmpAssignment.id });
    expect([200, 201]).toContain(s.status);

    const done1 = await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] });

    expect([200]).toContain(done1.status);

    const done2 = await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] });

    expect([200, 400, 409]).toContain(done2.status);

    await deleteAssignmentDeep(prisma, tmpAssignment.id);
  });

  it('PATCH /submissions/:id/responses → zákaz po dokončení (400/409/403)', async () => {
    const tmpAssignment = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 5,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: tmpAssignment.id });
    expect([200, 201]).toContain(s.status);

    await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] })
      .expect(200);

    // Non-empty responses so the lock guard is actually reached (empty array is a no-op).
    const q = await prisma.question.findFirst({
      where: { testId },
      select: { id: true },
    });
    const res = await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId: q!.id, givenText: 'x' }] });

    expect([400, 403, 409]).toContain(res.status);

    await deleteAssignmentDeep(prisma, tmpAssignment.id);
  });

  it('PATCH /submissions/:id/responses after finish → 409 SUBMISSION_LOCKED (DB-level)', async () => {
    const tmpAssignment = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId,
        targetType: 'STUDENTS' as any,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 5,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: tmpAssignment.id });
    expect([200, 201]).toContain(s.status);

    await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] })
      .expect(200);

    const q = await prisma.question.findFirst({ where: { testId }, select: { id: true } });
    const patchRes = await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId: q!.id, givenText: 'x' }] });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body?.errorCode ?? patchRes.body?.error).toBe('SUBMISSION_LOCKED');

    await deleteAssignmentDeep(prisma, tmpAssignment.id);
  });

  it('cross-org: GET /submissions/:id with submission from other org → 404 (no leak)', async () => {
    const subInOrgA = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .then((r) => r.body);
    const submissionId = subInOrgA.id;

    const res = await request(app.getHttpServer())
      .get(`/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(404);
  });

  it('POST /submissions → 404/403 když assignment je v jiné org (student nemá membership)', async () => {
    // vytvoř assignment v jiné org s jiným studentem (outsider)
    const now = new Date();
    const otherAss = await prisma.assignment.create({
      data: {
        organizationId: otherOrg.id,
        yearId: otherOrgAcademicYearId,
        testId, // POZOR: test je v org, ale pro test účely to necháme – real implementace může odmítnout (409/400).
        targetType: 'STUDENTS' as any,
        openAt: new Date(now.getTime() - 60_000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 2,
        createdById: teacherMembershipId, // může být i cizí člen; dle implementace možná 403, zde jen smoke
        students: { create: [{ studentId: outsiderMembershipId }] },
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`) // student z org, ale není přiřazen a jiná org
      .send({ assignmentId: otherAss.id });

    expect([403, 404, 409]).toContain(res.status);

    await deleteAssignmentDeep(prisma, otherAss.id);
  });
});
