// test/e2e/focus-test-session.e2e-spec.ts
// Covers Focus Test Mode bootstrap: GET /assignments/:id/test-session + reuse of
// PATCH /submissions/:id/responses and POST /submissions/:id/finish.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { setupOrgContext } from 'test/helpers';

describe('Focus Test Session (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ctx: Awaited<ReturnType<typeof setupOrgContext>>;
  let orgId: string;
  let mTeacher: string; // Membership.id
  let mStudent: string; // Membership.id
  let studentToken: string;

  // a second student in the same org, NOT targeted by the assignments
  let outsiderToken: string;

  let academicYearId: string;
  let testId: string;
  let questionId: string;

  // assignment ids
  let aOpen: string; // open window, maxAttempts 3
  let aSingle: string; // open window, maxAttempts 1
  let aClosed: string; // already closed

  const now = Date.now();
  const past = (ms: number) => new Date(now - ms).toISOString() as unknown as Date;
  const future = (ms: number) =>
    new Date(now + ms).toISOString() as unknown as Date;

  const mkAssignment = (over: Record<string, unknown>) =>
    prisma.assignment
      .create({
        data: {
          organizationId: orgId,
          yearId: academicYearId,
          testId,
          targetType: 'STUDENTS',
          openAt: past(60_000),
          closeAt: future(3_600_000),
          maxAttempts: 3,
          shuffle: false,
          showExplain: 'after_close',
          createdById: mTeacher,
          students: { create: [{ studentId: mStudent }] },
          ...over,
        },
        select: { id: true },
      })
      .then((a) => a.id);

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

    ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `focus_${now}`,
      with: { teacher: true, student: true },
    });
    orgId = ctx.organization.id;
    mTeacher = ctx.teacher!.membership.id;
    mStudent = ctx.student!.membership.id;
    studentToken = ctx.student!.accessToken;

    const outsider = await ctx.addMember($Enums.OrganizationRole.STUDENT, 'outsider');
    outsiderToken = outsider.accessToken;

    // Schools register as PENDING (awaiting SUPERADMIN approval); activate so execution is allowed.
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: $Enums.OrganizationStatus.ACTIVE },
    });

    // Reuse the org's current academic year (single-current-per-org constraint) and
    // widen its window to span "now" so neither expiry nor year-window guards fire.
    const yearWindow = {
      startsAt: past(365 * 24 * 3_600_000),
      endsAt: future(365 * 24 * 3_600_000),
    };
    const existingYear = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true, deletedAt: null },
      select: { id: true },
    });
    if (existingYear) {
      await prisma.academicYear.update({
        where: { id: existingYear.id },
        data: yearWindow,
      });
      academicYearId = existingYear.id;
    } else {
      const created = await prisma.academicYear.create({
        data: { orgId, label: `Focus ${now}`, isCurrent: true, ...yearWindow },
        select: { id: true },
      });
      academicYearId = created.id;
    }

    // One class section → org is R2_STRUCTURE_READY (execution allowed).
    await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: `F${now % 100000}`,
      },
    });

    const t = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Focus Test',
        creatorId: mTeacher,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    testId = t.id;
    const q = await prisma.question.create({
      data: {
        testId,
        text: 'Is 1 < 2?',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
      select: { id: true },
    });
    questionId = q.id;

    aOpen = await mkAssignment({ maxAttempts: 3, timeLimitSec: 1200 });
    aSingle = await mkAssignment({ maxAttempts: 1 });
    aClosed = await mkAssignment({
      openAt: past(7_200_000),
      closeAt: past(3_600_000),
    });
  });

  afterAll(async () => {
    await prisma.response
      .deleteMany({ where: { submission: { testId } } })
      .catch(() => {});
    await prisma.submission.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: testId } }).catch(() => {});
    await prisma.classSection
      .deleteMany({ where: { yearId: academicYearId } })
      .catch(() => {});
    await prisma.academicYear
      .deleteMany({ where: { id: academicYearId } })
      .catch(() => {});
    await prisma.membership
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  const getSession = (assignmentId: string, token: string) =>
    request(app.getHttpServer())
      .get(`/assignments/${assignmentId}/test-session`)
      .set('Authorization', `Bearer ${token}`);

  it('test-session payload never leaks the answer key', async () => {
    const res = await getSession(aOpen, studentToken).expect(200);
    const session = res.body.data ?? res.body;
    const question = session.test.questions[0];
    expect(question.id).toBe(questionId);
    expect(question).not.toHaveProperty('correctAnswer');
    expect(question).not.toHaveProperty('correctAnswers');
    expect(session.submission.startedAt).toBeDefined();
    expect(session.assignment.timeLimitSec).toBe(1200);
  });

  it('resumes instead of creating a duplicate active submission', async () => {
    const first = await getSession(aOpen, studentToken).expect(200);
    const second = await getSession(aOpen, studentToken).expect(200);
    const a = (first.body.data ?? first.body).submission.id;
    const b = (second.body.data ?? second.body).submission.id;
    expect(a).toBe(b);

    const count = await prisma.submission.count({
      where: { assignmentId: aOpen, studentId: mStudent, submittedAt: null },
    });
    expect(count).toBe(1);
  });

  it('a non-targeted student in the same org cannot open the assignment (403)', async () => {
    await getSession(aOpen, outsiderToken).expect(403);
  });

  it('autosave is idempotent per questionId (no duplicate Response)', async () => {
    const res = await getSession(aOpen, studentToken).expect(200);
    const session = res.body.data ?? res.body;
    const submissionId = session.submission.id;

    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText: 'true' }], clientVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText: 'false' }], clientVersion: 2 })
      .expect(200);

    const responses = await prisma.response.findMany({
      where: { submissionId, questionId },
    });
    expect(responses).toHaveLength(1);
    expect(responses[0]?.givenText).toBe('false');
  });

  it('enforces maxAttempts and locks responses after submit', async () => {
    // start the single-attempt session
    const res = await getSession(aSingle, studentToken).expect(200);
    const session = res.body.data ?? res.body;
    const submissionId = session.submission.id;

    await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText: 'true' }] })
      .expect(200);

    // PATCH after submit → locked (409)
    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText: 'false' }] })
      .expect(409);

    // re-open → maxAttempts (1) exhausted → 400
    await getSession(aSingle, studentToken).expect(400);
  });

  it('enforces closeAt when starting a fresh attempt (400)', async () => {
    await getSession(aClosed, studentToken).expect(400);
  });

  // ── Focus-event audit logging (not anti-cheat; nothing is blocked) ──────────
  describe('focus events', () => {
    const postEvent = (
      submissionId: string,
      token: string,
      type: string,
    ) =>
      request(app.getHttpServer())
        .post(`/submissions/${submissionId}/focus-events`)
        .set('Authorization', `Bearer ${token}`)
        .send({ events: [{ type, clientTimestamp: Date.now() }] });

    it('a foreign student cannot log events into another student submission (403)', async () => {
      const res = await getSession(aOpen, studentToken).expect(200);
      const submissionId = (res.body.data ?? res.body).submission.id;
      await postEvent(submissionId, outsiderToken, 'window_blur').expect(403);
    });

    it('records an audit row for a valid student without touching responses', async () => {
      const res = await getSession(aOpen, studentToken).expect(200);
      const submissionId = (res.body.data ?? res.body).submission.id;

      const responsesBefore = await prisma.response.findMany({
        where: { submissionId },
        select: { id: true, givenText: true },
      });
      const statusBefore = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true, submittedAt: true },
      });

      await postEvent(submissionId, studentToken, 'visibility_hidden').expect(
        202,
      );

      const logs = await prisma.auditLog.findMany({
        where: { entityId: submissionId, action: { startsWith: 'FOCUS_EVENT:' } },
      });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0]?.entityType).toBe('TEST');

      // No mutation of responses or submission status.
      const responsesAfter = await prisma.response.findMany({
        where: { submissionId },
        select: { id: true, givenText: true },
      });
      expect(responsesAfter).toEqual(responsesBefore);
      const statusAfter = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true, submittedAt: true },
      });
      expect(statusAfter).toEqual(statusBefore);
    });

    it('still accepts events after submit without changing the submission', async () => {
      // dedicated assignment so we can finish a fresh attempt
      const assignmentId = await mkAssignment({ maxAttempts: 1 });
      const res = await getSession(assignmentId, studentToken).expect(200);
      const submissionId = (res.body.data ?? res.body).submission.id;

      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses: [{ questionId, givenText: 'true' }] })
        .expect(200);

      const before = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true, submittedAt: true },
      });

      await postEvent(submissionId, studentToken, 'window_focus').expect(202);

      const after = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true, submittedAt: true },
      });
      expect(after).toEqual(before);
    });
  });
});
