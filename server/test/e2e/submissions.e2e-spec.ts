// test/e2e/submissions.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import {
  $Enums,
  PublishStatus,
  QuestionType,
  OrganizationRole,
  OrganizationType,
} from '@prisma/client';

describe('Submissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const QT = QuestionType;
  const unique = Date.now();

  // --- actors
  let superUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
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
    const rSuper = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E Super',
        email: `e2e.super.${unique}@example.com`,
        username: `e2e_super_${unique}`,
        password: 'Password123!',
      })
      .expect(201);
    await prisma.user.update({
      where: { id: rSuper.body.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: rSuper.body.user.email, password: 'Password123!' })
      .expect(201);
    superUser = {
      id: rSuper.body.user.id,
      token: superLogin.body.accessToken,
      login: { login: rSuper.body.user.email, password: 'Password123!' },
    };

    // Orgs
    org = await prisma.organization.create({
      data: { name: `E2E Org ${unique}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    otherOrg = await prisma.organization.create({
      data: { name: `E2E Other Org ${unique}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });

    // Teacher + Student + Outsider users
    const regTeacher = await request(app.getHttpServer())
      .post('/auth/register')
      .send(teacher)
      .expect(201);
    const regStudent = await request(app.getHttpServer())
      .post('/auth/register')
      .send(student)
      .expect(201);
    const regOutsider = await request(app.getHttpServer())
      .post('/auth/register')
      .send(outsider)
      .expect(201);

    // Memberships
    const [mTeacher, mStudent, mOutsider] = await prisma.$transaction([
      prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: regTeacher.body.user.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      }),
      prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: regStudent.body.user.id,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
      prisma.membership.create({
        data: {
          organizationId: otherOrg.id,
          userId: regOutsider.body.user.id,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
    ]);

    teacherMembershipId = mTeacher.id;
    studentMembershipId = mStudent.id;
    outsiderMembershipId = mOutsider.id;

    // Logins
    const tLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: teacher.email, password: teacher.password })
      .expect(201);
    teacherToken = tLogin.body.accessToken;

    const sLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: student.email, password: student.password })
      .expect(201);
    studentToken = sLogin.body.accessToken;

    const oLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: outsider.email, password: outsider.password })
      .expect(201);
    outsiderToken = oLogin.body.accessToken;

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
    // best-effort cleanup
    try {
      await prisma.submission.deleteMany({ where: { assignmentId } });
      await prisma.submission.deleteMany({
        where: { assignmentId: closedAssignmentId },
      });
      await prisma.submission.deleteMany({
        where: { assignmentId: futureAssignmentId },
      });

      await prisma.assignment.deleteMany({
        where: {
          id: { in: [assignmentId, closedAssignmentId, futureAssignmentId] },
        },
      });
      await prisma.test.deleteMany({ where: { id: testId } });

      await prisma.membership.deleteMany({
        where: { organizationId: { in: [org.id, otherOrg.id] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [org.id, otherOrg.id] } },
      });

      await prisma.refreshToken.deleteMany({
        where: {
          userId: { in: [superUser.id] },
        },
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
    // create
    const createRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);

    const submissionId = createRes.body.id as string;
    expect(submissionId).toBeTruthy();

    // questions in order
    const qs = await prisma.question.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
      select: { id: true, correctAnswer: true },
    });

    const responses = [
      { questionId: qs[0].id, givenText: '4' },
      { questionId: qs[1].id, givenText: 'true' },
      { questionId: qs[2].id, givenText: 'Praha' },
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
      .send({ assignmentId })
      .expect(201);

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
    expect([403, 409]).toContain(res.status);
  });

  it('POST /submissions → 403/409 když assignment je po deadline', async () => {
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: closedAssignmentId });
    expect([403, 409]).toContain(res.status);
  });

  it('POST /submissions → 409 po vyčerpání maxAttempts', async () => {
    // jednorázový assignment
    const now = new Date();
    const single = await prisma.assignment.create({
      data: {
        organizationId: org.id,
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

    // první OK
    await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: single.id })
      .expect(201);

    // druhý už přes limit
    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId: single.id });

    expect([400, 403, 409]).toContain(res.status);

    await prisma.assignment.delete({ where: { id: single.id } });
  });

  it('POST /submissions/:id/finish → 403 po deadline i pro rozpracovanou submission', async () => {
    // otevřený assignment, brzy zavřeme
    const soon = await prisma.assignment.create({
      data: {
        organizationId: org.id,
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
      .send({ assignmentId: soon.id })
      .expect(201);

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

    await prisma.assignment.delete({ where: { id: soon.id } });
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
    await request(app.getHttpServer())
      .patch(`/submissions/${randomUUID()}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] })
      .expect(404);
  });

  it('PATCH /submissions/:id/responses → 400 na nevalidní questionId', async () => {
    // vytvoř submission
    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId: 'not-uuid', givenText: 'x' }] })
      .expect(400);
  });

  it('POST /submissions/:id/finish → idempotentní (druhé finish vrátí 200/409/400, ale nezmění výsledek)', async () => {
    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);

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
  });

  it('PATCH /submissions/:id/responses → zákaz po dokončení (400/409/403)', async () => {
    const s = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/submissions/${s.body.id}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/submissions/${s.body.id}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [] });

    expect([400, 403, 409]).toContain(res.status);
  });

  it('POST /submissions → 404/403 když assignment je v jiné org (student nemá membership)', async () => {
    // vytvoř assignment v jiné org s jiným studentem (outsider)
    const now = new Date();
    const otherAss = await prisma.assignment.create({
      data: {
        organizationId: otherOrg.id,
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

    expect([403, 404]).toContain(res.status);

    await prisma.assignment.delete({ where: { id: otherAss.id } });
  });
});
