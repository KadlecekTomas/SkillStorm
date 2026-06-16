// test/e2e/analytics-submission-snapshot.e2e-spec.ts
/**
 * Phase 2 — Immutable analytics snapshot (SubmissionFact / ResponseFact).
 *
 * A — finish() creates exactly one SubmissionFact + one ResponseFact per Response.
 * B — repeated finish() is idempotent: no duplicate SubmissionFact.
 * C — ResponseFact does NOT carry correctAnswerSnapshot / explanationSnapshot.
 * D — snapshot carries userId, membershipId and studentId (when resolvable);
 *     academicYear/classSection come from submit-time context.
 * E — when Student.id cannot be resolved, finish() still succeeds; snapshot has
 *     studentId=null and dataQuality=PARTIAL.
 * F — editing the question/test after submit does NOT change the stored fact.
 * G — if the snapshot service throws, finish() rolls back (no finalize, no fact).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import {
  AnalyticsDataQuality,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { AnalyticsSnapshotService } from '@/analytics/analytics-snapshot.service';
import { setupOrgContext, login } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

async function activateOrg(prisma: PrismaService, orgId: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: { status: OrganizationStatus.ACTIVE },
  });
}

async function getActiveYear(prisma: PrismaService, orgId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });
  if (!year) throw new Error(`No current academic year for org ${orgId}`);
  return year.id;
}

async function getSubject(prisma: PrismaService, orgId: string) {
  // Subject is global; it is linked to an org via OrgSubject (auto-provisioned on org setup).
  const orgSubject = await prisma.orgSubject.findFirst({
    where: { organizationId: orgId },
    select: { subjectId: true },
  });
  if (!orgSubject) throw new Error(`No org subject for org ${orgId}`);
  return orgSubject.subjectId;
}

interface SubmittableFixture {
  orgId: string;
  yearId: string;
  classSectionId: string;
  testId: string;
  questionId: string;
  assignmentId: string;
  submissionId: string;
  studentToken: string;
  studentMembershipId: string;
  studentUserId: string;
  studentRecordId: string;
}

describe('Analytics Submission Snapshot (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const allOrgIds: string[] = [];
  const allUserIds: string[] = [];

  const CORRECT_ANSWER = 'Paris';
  const QUESTION_TEXT = 'What is the capital of France?';
  const QUESTION_SCORE = 10;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    await prisma.catalogSubject.upsert({
      where: { code: 'MAT' },
      update: {},
      create: { code: 'MAT', name: 'Matematika' },
    });
  });

  afterAll(async () => {
    for (const orgId of allOrgIds) {
      await prisma.responseFact.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.submissionFact.deleteMany({
        where: { organizationId: orgId },
      });
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
      await prisma.enrollment.deleteMany({ where: { orgId } });
      await prisma.classSection.deleteMany({ where: { orgId } });
      await prisma.student.deleteMany({ where: { orgId } });
      // Subjects are global (shared via OrgSubject) — do not delete them here.
      await prisma.orgSubject.deleteMany({ where: { organizationId: orgId } });
      await prisma.academicYear.deleteMany({ where: { orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (allUserIds.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: allUserIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  /**
   * Build an enrolled student with an open submission for a PUBLISHED test that is
   * linked to a topic (so the snapshot resolves full COMPLETE context). The test +
   * assignment are created directly via Prisma to keep the fixture deterministic and
   * independent of publish/assign endpoint hardening; only create+finish go through the API.
   */
  async function buildSubmittable(seed: string): Promise<SubmittableFixture> {
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed,
      with: { student: true },
    });
    const orgId = ctx.organization.id;
    allOrgIds.push(orgId);
    allUserIds.push(ctx.owner.user.id);
    if (ctx.student) allUserIds.push(ctx.student.user.id);

    await activateOrg(prisma, orgId);
    const yearId = await getActiveYear(prisma, orgId);
    const subjectId = await getSubject(prisma, orgId);

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { catalogSubjectId: true },
    });
    if (!subject?.catalogSubjectId) {
      throw new Error('Provisioned subject has no catalogSubjectId');
    }

    const creator = await prisma.membership.findFirst({
      where: { userId: ctx.owner.user.id, organizationId: orgId },
      select: { id: true },
    });
    const creatorMembershipId = creator!.id;

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        section: `${Date.now()}${Math.floor(Math.random() * 9999)}`,
        grade: SchoolGrade.GRADE_5,
      },
      select: { id: true },
    });
    const classSectionId = classSection.id;

    const studentMembershipId = ctx.student!.membership.id as string;
    const studentUserId = ctx.student!.user.id;
    const studentRecord = await prisma.student.upsert({
      where: { membershipId: studentMembershipId },
      update: {},
      create: { membershipId: studentMembershipId, orgId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentRecord.id,
        classSectionId,
        orgId,
        yearId,
        status: 'ACTIVE',
      },
    });

    // Topic chain: CatalogTopic → SubjectLevel → TopicLevel.
    const catalogTopic = await prisma.catalogTopic.create({
      data: { subjectId: subject.catalogSubjectId, name: `Topic ${seed}` },
      select: { id: true },
    });
    const subjectLevel = await prisma.subjectLevel.upsert({
      where: { subjectId_grade: { subjectId, grade: SchoolGrade.GRADE_5 } },
      update: {},
      create: { subjectId, grade: SchoolGrade.GRADE_5 },
      select: { id: true },
    });
    const topicLevel = await prisma.topicLevel.create({
      data: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
      },
      select: { id: true },
    });

    // Published test with a topic link (TestAssignment) + one scorable question.
    const test = await prisma.test.create({
      data: {
        organizationId: orgId,
        subjectId,
        academicYearId: yearId,
        allowedGrades: [SchoolGrade.GRADE_5],
        title: `Snapshot ${seed}`,
        version: 1,
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        creatorId: creatorMembershipId,
      },
      select: { id: true },
    });
    const testId = test.id;

    const question = await prisma.question.create({
      data: {
        testId,
        text: QUESTION_TEXT,
        type: QuestionType.FILL_IN_THE_BLANK,
        score: QUESTION_SCORE,
        correctAnswer: CORRECT_ANSWER,
        order: 1,
      },
      select: { id: true },
    });
    const questionId = question.id;

    await prisma.testAssignment.create({
      data: { testId, topicLevelId: topicLevel.id, isPrimary: true },
    });

    // Scheduled assignment with topicLevelId so the snapshot context is COMPLETE.
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId,
        targetType: 'CLASS',
        classSectionId,
        topicLevelId: topicLevel.id,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 86_400_000),
        maxAttempts: 3,
        createdById: creatorMembershipId,
      },
      select: { id: true },
    });
    const assignmentId = assignment.id;

    const studentToken = await login(app, {
      email: ctx.student!.login.email,
      password: ctx.student!.login.password,
      organizationId: orgId,
    });

    const subRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);
    const submissionId = unwrap(subRes).id as string;

    return {
      orgId,
      yearId,
      classSectionId,
      testId,
      questionId,
      assignmentId,
      submissionId,
      studentToken,
      studentMembershipId,
      studentUserId,
      studentRecordId: studentRecord.id,
    };
  }

  const finish = (fx: SubmittableFixture) =>
    request(app.getHttpServer())
      .post(`/submissions/${fx.submissionId}/finish`)
      .set('Authorization', `Bearer ${fx.studentToken}`)
      .send({
        responses: [{ questionId: fx.questionId, givenText: CORRECT_ANSWER }],
      });

  // ── A + B + C + D ──────────────────────────────────────────────────────────
  describe('A/B/C/D — fact creation, idempotence, no answer-key, identity & context', () => {
    let fx: SubmittableFixture;

    beforeAll(async () => {
      fx = await buildSubmittable(`snap_main_${Date.now()}`);
      await finish(fx).expect(200);
    });

    it('A — exactly one SubmissionFact + one ResponseFact exist', async () => {
      const facts = await prisma.submissionFact.findMany({
        where: { submissionId: fx.submissionId },
      });
      expect(facts).toHaveLength(1);

      const responseFacts = await prisma.responseFact.findMany({
        where: { submissionFactId: facts[0]!.id },
      });
      expect(responseFacts).toHaveLength(1);
      const rf = responseFacts[0]!;
      expect(rf.questionId).toBe(fx.questionId);
      expect(rf.isCorrect).toBe(true);
      expect(rf.score).toBe(QUESTION_SCORE);
      expect(rf.maxScore).toBe(QUESTION_SCORE);
      expect(rf.givenTextSnapshot).toBe(CORRECT_ANSWER);
      expect(rf.questionTextSnapshot).toBe(QUESTION_TEXT);
    });

    it('B — repeated finish() does not create a duplicate SubmissionFact', async () => {
      await finish(fx).expect(200); // idempotent submit

      const count = await prisma.submissionFact.count({
        where: { submissionId: fx.submissionId },
      });
      expect(count).toBe(1);

      const fact = await prisma.submissionFact.findUnique({
        where: { submissionId: fx.submissionId },
        select: { id: true },
      });
      const rfCount = await prisma.responseFact.count({
        where: { submissionFactId: fact!.id },
      });
      expect(rfCount).toBe(1);
    });

    it('C — ResponseFact has no correctAnswerSnapshot / explanationSnapshot fields', async () => {
      const rf = await prisma.responseFact.findFirst({
        where: { submissionId: fx.submissionId },
      });
      expect(rf).not.toBeNull();
      expect('correctAnswerSnapshot' in (rf as object)).toBe(false);
      expect('explanationSnapshot' in (rf as object)).toBe(false);
    });

    it('D — SubmissionFact carries identity anchors + submit-time context', async () => {
      const fact = await prisma.submissionFact.findUnique({
        where: { submissionId: fx.submissionId },
      });
      expect(fact).not.toBeNull();
      expect(fact!.userId).toBe(fx.studentUserId);
      expect(fact!.membershipId).toBe(fx.studentMembershipId);
      expect(fact!.studentId).toBe(fx.studentRecordId);
      expect(fact!.organizationId).toBe(fx.orgId);
      expect(fact!.academicYearId).toBe(fx.yearId);
      expect(fact!.classSectionId).toBe(fx.classSectionId);
      expect(fact!.testId).toBe(fx.testId);
      expect(fact!.score).toBe(QUESTION_SCORE);
      expect(fact!.maxScore).toBe(QUESTION_SCORE);
      expect(fact!.percentage).toBe(100);
      expect(fact!.questionCount).toBe(1);
      expect(fact!.correctCount).toBe(1);
      expect(fact!.incorrectCount).toBe(0);
      expect(fact!.dataQuality).toBe(AnalyticsDataQuality.COMPLETE);
    });
  });

  // ── E — missing Student.id → PARTIAL, no crash ───────────────────────────────
  describe('E — unresolvable Student.id degrades to PARTIAL without failing submit', () => {
    it('E1 — finish succeeds, studentId is null, dataQuality is PARTIAL', async () => {
      const fx = await buildSubmittable(`snap_partial_${Date.now()}`);

      // Remove the Student row (cascades the enrollment). Submission references the
      // Membership, so it survives — but Student.id can no longer be resolved.
      await prisma.student.delete({ where: { id: fx.studentRecordId } });

      await finish(fx).expect(200);

      const fact = await prisma.submissionFact.findUnique({
        where: { submissionId: fx.submissionId },
      });
      expect(fact).not.toBeNull();
      expect(fact!.studentId).toBeNull();
      expect(fact!.userId).toBe(fx.studentUserId); // userId still resolvable
      expect(fact!.membershipId).toBe(fx.studentMembershipId);
      expect(fact!.dataQuality).toBe(AnalyticsDataQuality.PARTIAL);
    });
  });

  // ── F — immutability after question/test edit ────────────────────────────────
  describe('F — editing question/test after submit does not change the fact', () => {
    it('F1 — fact + responseFact snapshots are unchanged after question mutation', async () => {
      const fx = await buildSubmittable(`snap_immut_${Date.now()}`);
      await finish(fx).expect(200);

      const before = await prisma.submissionFact.findUnique({
        where: { submissionId: fx.submissionId },
      });
      const rfBefore = await prisma.responseFact.findFirst({
        where: { submissionId: fx.submissionId },
      });

      // Mutate the live question + bump the test version after submit.
      await prisma.question.update({
        where: { id: fx.questionId },
        data: {
          text: 'Totally different question',
          correctAnswer: 'Berlin',
          score: 999,
        },
      });
      await prisma.test.update({
        where: { id: fx.testId },
        data: { version: { increment: 1 } },
      });

      const after = await prisma.submissionFact.findUnique({
        where: { submissionId: fx.submissionId },
      });
      const rfAfter = await prisma.responseFact.findFirst({
        where: { submissionId: fx.submissionId },
      });

      expect(after!.testVersion).toBe(before!.testVersion);
      expect(after!.score).toBe(before!.score);
      expect(after!.maxScore).toBe(before!.maxScore);
      expect(rfAfter!.questionTextSnapshot).toBe(QUESTION_TEXT);
      expect(rfAfter!.score).toBe(QUESTION_SCORE);
      expect(rfAfter!.maxScore).toBe(QUESTION_SCORE);
      expect(rfBefore!.questionTextSnapshot).toBe(QUESTION_TEXT);
    });
  });

  // ── G — fail-closed rollback ─────────────────────────────────────────────────
  describe('G — snapshot failure rolls back finish() (fail-closed)', () => {
    it('G1 — when snapshot throws, submission stays unfinished and no fact is written', async () => {
      const fx = await buildSubmittable(`snap_rollback_${Date.now()}`);

      const snapshotService = app.get(AnalyticsSnapshotService);
      const spy = jest
        .spyOn(snapshotService, 'createSubmissionSnapshot')
        .mockRejectedValueOnce(new Error('boom: forced snapshot failure'));

      // finish() should fail (transaction rolls back).
      await finish(fx).expect((r) => {
        expect(r.status).toBeGreaterThanOrEqual(500);
      });

      spy.mockRestore();

      const submission = await prisma.submission.findUnique({
        where: { id: fx.submissionId },
        select: { submittedAt: true, status: true },
      });
      expect(submission!.submittedAt).toBeNull(); // not finalized
      expect(submission!.status).toBe('PENDING');

      const factCount = await prisma.submissionFact.count({
        where: { submissionId: fx.submissionId },
      });
      expect(factCount).toBe(0);

      // And a subsequent (non-mocked) finish now succeeds and writes exactly one fact.
      await finish(fx).expect(200);
      const finalCount = await prisma.submissionFact.count({
        where: { submissionId: fx.submissionId },
      });
      expect(finalCount).toBe(1);
    });
  });
});
