/**
 * BLOK 3 — concurrency & resilience of the submission flow.
 *
 * Scenario: a whole class (30 students) answering the same assignment at
 * once — truly parallel requests, not sequential. Criteria:
 *   - no lost response (every student's answers persisted exactly),
 *   - no deadlock, no 5xx,
 *   - a same-student autosave burst stays consistent,
 *   - parallel finish() is idempotent and every submission is scored.
 *
 * Locking strategy under test (see submissions.service):
 * pessimistic SELECT ... FOR UPDATE per submission inside a transaction.
 * Chosen over optimistic versioning because contention is per-submission
 * row (mostly a single student's autosaves), transactions are short, and
 * the response upsert (find→create/update) would otherwise race with
 * itself; the DB trigger responses_lock_after_submit remains the second
 * line of defense after submit (see responses-lock-trigger spec).
 */
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { setupOrgContext } from 'test/helpers';

const STUDENTS = 30;
const AUTOSAVE_BURST = 5;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function reportLatencies(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  // eslint-disable-next-line no-console
  console.log(
    `[load] ${label}: n=${sorted.length} p50=${percentile(sorted, 50)}ms ` +
      `p95=${percentile(sorted, 95)}ms max=${sorted[sorted.length - 1]}ms`,
  );
}

describe('Submissions concurrency load (30 parallel students)', () => {
  jest.setTimeout(300_000);

  let app: INestApplication;
  let prisma: PrismaService;

  let baseUrl: string;
  let orgId: string;
  let testId: string;
  let assignmentId: string;
  let questionIds: string[] = [];
  let students: { token: string; membershipId: string }[] = [];

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    // real listening socket: 30 truly parallel connections reset ephemeral
    // supertest servers (ECONNRESET); a bound port with keep-alive is stable
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `load_${Date.now()}`,
    });
    orgId = ctx.organization.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: $Enums.OrganizationStatus.ACTIVE },
    });
    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    await prisma.academicYear.update({
      where: { id: year!.id },
      data: { startsAt: new Date('2025-09-01'), endsAt: new Date('2027-08-31') },
    });
    await prisma.classSection.create({
      data: {
        orgId,
        yearId: year!.id,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'L',
        label: '7.L',
      },
    });

    const test = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Load test',
        creatorId: ctx.owner.membership.id,
        status: $Enums.PublishStatus.PUBLISHED,
        academicYearId: year!.id,
        allowedGrades: [$Enums.SchoolGrade.GRADE_7],
      },
      select: { id: true },
    });
    testId = test.id;
    for (let i = 1; i <= 3; i++) {
      const q = await prisma.question.create({
        data: {
          testId,
          text: `Q${i}: 1 < ${i + 1}?`,
          type: $Enums.QuestionType.TRUE_FALSE,
          correctAnswer: 'true',
          order: i,
        },
        select: { id: true },
      });
      questionIds.push(q.id);
    }

    // 30 students — registered sequentially: parallel registration races on
    // username uniqueness in authAs and is not what this suite measures
    for (let i = 0; i < STUDENTS; i++) {
      const s = await ctx.addMember(
        $Enums.OrganizationRole.STUDENT,
        `ls${i}x${Math.floor(Math.random() * 1e6)}`,
      );
      students.push({ token: s.accessToken, membershipId: s.membership.id });
    }

    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year!.id,
        testId,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.owner.membership.id,
        students: {
          create: students.map((s) => ({ studentId: s.membershipId })),
        },
      },
      select: { id: true },
    });
    assignmentId = assignment.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('whole class answers in parallel: no lost response, no deadlock, no 5xx', async () => {
    const server = baseUrl;
    const timed = async (fn: () => request.Test, bucket: number[]) => {
      const t0 = Date.now();
      const res = await fn();
      bucket.push(Date.now() - t0);
      return res;
    };

    // 1) all students start their submission at once
    const createLat: number[] = [];
    const createResults = await Promise.all(
      students.map((s) =>
        timed(
          () =>
            request(server)
              .post('/submissions')
              .set('Authorization', `Bearer ${s.token}`)
              .send({ assignmentId }),
          createLat,
        ),
      ),
    );
    const submissionIds: string[] = [];
    for (const res of createResults) {
      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body.id).toBeTruthy();
      submissionIds.push(body.id);
    }
    reportLatencies('POST /submissions (30 parallel)', createLat);

    // 2) three rounds of answers — each round is 30 parallel PATCHes
    const patchLat: number[] = [];
    for (let round = 0; round < questionIds.length; round++) {
      const results = await Promise.all(
        students.map((s, i) =>
          timed(
            () =>
              request(server)
                .patch(`/submissions/${submissionIds[i]}/responses`)
                .set('Authorization', `Bearer ${s.token}`)
                .send({
                  responses: [
                    {
                      questionId: questionIds[round]!,
                      givenText: `true`,
                    },
                  ],
                }),
            patchLat,
          ),
        ),
      );
      for (const res of results) {
        expect(res.status).toBeLessThan(500);
        expect(res.status).toBe(200);
      }
    }
    reportLatencies(
      `PATCH :id/responses (${questionIds.length}×30 parallel)`,
      patchLat,
    );

    // 3) one student hammers autosave in a parallel burst — the row lock
    //    serializes the writes; final state must be consistent, no 5xx
    const burstTarget = submissionIds[0]!;
    const burst = await Promise.all(
      Array.from({ length: AUTOSAVE_BURST }).map((_, v) =>
        request(server)
          .patch(`/submissions/${burstTarget}/responses`)
          .set('Authorization', `Bearer ${students[0]!.token}`)
          .send({
            responses: [{ questionId: questionIds[0]!, givenText: `burst_${v}` }],
          }),
      ),
    );
    for (const res of burst) expect(res.status).toBe(200);
    const burstRows = await prisma.response.findMany({
      where: { submissionId: burstTarget, questionId: questionIds[0]! },
      select: { givenText: true },
    });
    expect(burstRows.length).toBe(1); // no duplicate rows from the upsert race
    expect(burstRows[0]!.givenText).toMatch(/^"?burst_\d"?$/);
    // restore the expected answer for scoring assertions below
    await request(server)
      .patch(`/submissions/${burstTarget}/responses`)
      .set('Authorization', `Bearer ${students[0]!.token}`)
      .send({ responses: [{ questionId: questionIds[0]!, givenText: 'true' }] })
      .expect(200);

    // 4) everyone finishes at once (plus a duplicate finish for idempotency)
    const finishLat: number[] = [];
    const finishResults = await Promise.all(
      students.map((s, i) =>
        timed(
          () =>
            request(server)
              .post(`/submissions/${submissionIds[i]}/finish`)
              .set('Authorization', `Bearer ${s.token}`)
              .send({}),
          finishLat,
        ),
      ),
    );
    for (const res of finishResults) {
      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body.status).toBe('APPROVED');
    }
    reportLatencies('POST :id/finish (30 parallel)', finishLat);

    const dupFinish = await request(server)
      .post(`/submissions/${submissionIds[0]}/finish`)
      .set('Authorization', `Bearer ${students[0]!.token}`)
      .send({});
    expect(dupFinish.status).toBe(200); // idempotent double-submit

    // 5) ground truth in the DB: nothing lost, everything scored
    const rows = await prisma.submission.findMany({
      where: { id: { in: submissionIds } },
      select: {
        id: true,
        submittedAt: true,
        score: true,
        responses: { select: { questionId: true, givenText: true } },
      },
    });
    expect(rows.length).toBe(STUDENTS);
    for (const row of rows) {
      expect(row.submittedAt).not.toBeNull();
      expect(row.score).toBe(1);
      expect(row.responses.length).toBe(questionIds.length);
      const byQuestion = new Set(row.responses.map((r) => r.questionId));
      expect(byQuestion.size).toBe(questionIds.length); // no dup/lost rows
    }
  });
});
