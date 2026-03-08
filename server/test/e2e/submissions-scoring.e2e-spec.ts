// test/e2e/submissions-scoring.e2e-spec.ts
/**
 * E2E tests for the MULTIPLE_CHOICE scoring engine.
 *
 * Verifies:
 * - Exact match awards full points
 * - Case + whitespace normalization ("a " matches "A")
 * - Wrong answer awards 0 points (status still APPROVED)
 * - Multi-answer mode (correctAnswers array) scores correctly
 * - When both correctAnswer and correctAnswers are set, correctAnswers takes precedence (no REJECTED)
 */
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { setupOrgContext } from 'test/helpers';

describe('Submissions Scoring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ctx: Awaited<ReturnType<typeof setupOrgContext>>;
  let orgId: string;
  let yearId: string;
  let teacherMembershipId: string;
  let studentMembershipId: string;
  let studentToken: string;

  // Collect test IDs so we can cascade-delete everything in afterAll
  const testIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ctx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: 'scoring',
      with: { student: true },
    });
    orgId = ctx.organization.id;

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) throw new Error('Missing current academic year in scoring fixture org');
    yearId = year.id;

    // R2_STRUCTURE_READY requires at least one class section → satisfies deriveOrgReadiness
    await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: SchoolGrade.GRADE_9,
        section: 'SC',
        label: '9.SC',
      },
    });

    teacherMembershipId = ctx.teacher!.membership.id;
    studentMembershipId = ctx.student!.membership.id;
    studentToken = ctx.student!.accessToken;
  });

  afterAll(async () => {
    // Deleting a Test cascades → Assignment → Submission (onDelete: Cascade chain)
    if (testIds.length > 0) {
      await prisma.test.deleteMany({ where: { id: { in: testIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Create a test with one MULTIPLE_CHOICE question and an assignment for the student. */
  async function buildScenario(opts: {
    correctAnswer?: string | null;
    correctAnswers?: string[];
    points: number;
  }) {
    const { correctAnswer = null, correctAnswers = [], points } = opts;
    const test = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: `Scoring fixture ${Date.now()}`,
        status: PublishStatus.PUBLISHED,
        creatorId: teacherMembershipId,
        questions: {
          create: [
            {
              text: 'Choose the correct option.',
              type: QuestionType.MULTIPLE_CHOICE,
              order: 1,
              score: points,
              correctAnswer,
              correctAnswers,
            },
          ],
        },
      },
      select: { id: true, questions: { select: { id: true } } },
    });
    testIds.push(test.id);

    const questionId = test.questions[0]?.id;
    if (!questionId) throw new Error('buildScenario: question not created');

    const now = new Date();
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId: test.id,
        targetType: 'STUDENTS' as any,
        openAt: new Date(now.getTime() - 60_000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 5,
        createdById: teacherMembershipId,
        students: { create: [{ studentId: studentMembershipId }] },
      },
      select: { id: true },
    });

    return {
      testId: test.id,
      assignmentId: assignment.id,
      questionId,
    };
  }

  /** Full create → finish flow. Returns the finish response. */
  async function submitAndFinish(assignmentId: string, questionId: string, givenText: string) {
    const createRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId });
    expect([200, 201]).toContain(createRes.status);
    const submissionId: string = createRes.body.id;
    expect(submissionId).toBeTruthy();

    const finishRes = await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText }] });

    return { finishRes, submissionId };
  }

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------

  it('exact match "A" → score 1.0, status APPROVED, awardedPoints === points', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswer: 'A',
      points: 5,
    });

    const { finishRes, submissionId } = await submitAndFinish(assignmentId, questionId, 'A');

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(1);

    // Verify the Response row: awardedPoints === 5
    const resp = await prisma.response.findFirst({
      where: { submissionId },
      select: { awardedPoints: true, isCorrect: true },
    });
    expect(resp?.isCorrect).toBe(true);
    expect(resp?.awardedPoints).toBe(5);
  });

  it('lowercase + trailing space "a " → normalised to match "A" → score 1.0', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswer: 'A',
      points: 5,
    });

    const { finishRes, submissionId } = await submitAndFinish(assignmentId, questionId, 'a ');

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(1);

    const resp = await prisma.response.findFirst({
      where: { submissionId },
      select: { awardedPoints: true, isCorrect: true },
    });
    expect(resp?.isCorrect).toBe(true);
    expect(resp?.awardedPoints).toBe(5);
  });

  it('wrong answer "B" → score 0, status APPROVED, awardedPoints === 0', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswer: 'A',
      points: 5,
    });

    const { finishRes, submissionId } = await submitAndFinish(assignmentId, questionId, 'B');

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(0);

    const resp = await prisma.response.findFirst({
      where: { submissionId },
      select: { awardedPoints: true, isCorrect: true },
    });
    expect(resp?.isCorrect).toBe(false);
    expect(resp?.awardedPoints).toBe(0);
  });

  it('multi correctAnswers ["A","B"]: both selected → score 1.0', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswers: ['A', 'B'],
      points: 4,
    });

    // Student sends a JSON array (as serialized by the frontend)
    const { finishRes } = await submitAndFinish(
      assignmentId,
      questionId,
      JSON.stringify(['A', 'B']),
    );

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(1);
  });

  it('multi correctAnswers ["A","B"]: only one selected → score 0', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswers: ['A', 'B'],
      points: 4,
    });

    const { finishRes } = await submitAndFinish(
      assignmentId,
      questionId,
      JSON.stringify(['A']),
    );

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(0);
  });

  it('both correctAnswer AND correctAnswers set → prefers correctAnswers, not REJECTED', async () => {
    const { assignmentId, questionId } = await buildScenario({
      correctAnswer: 'A', // redundant (seed-style / legacy data)
      correctAnswers: ['A'],
      points: 5,
    });

    const { finishRes } = await submitAndFinish(
      assignmentId,
      questionId,
      JSON.stringify(['A']),
    );

    expect(finishRes.status).toBe(200);
    // Must be APPROVED (not REJECTED due to "unscorable")
    expect(finishRes.body.status).toBe('APPROVED');
    expect(finishRes.body.score).toBe(1);
  });
});
