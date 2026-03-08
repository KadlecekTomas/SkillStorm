// test/e2e/test-flow-hardening.e2e-spec.ts
/**
 * End-to-End Test Flow Hardening
 *
 * A — Publish blocked: no questions → 409 TEST_NOT_ASSIGNABLE;
 *     inactive subject → 400 TEST_NOT_ASSIGNABLE
 * B — Assign blocked: DRAFT test → 400 TEST_NOT_PUBLISHED;
 *     test in year1 + class in year2 → 400 YEAR_MISMATCH
 * C — Submission snapshot: finish() stores correctAnswerSnapshot,
 *     awardedPoints, maxPoints in Response rows
 * D — Tenant isolation: student in org1 does not see tests from org2
 * L — Student enrolled in classA sees test assigned to classA in GET /tests
 * M — Student enrolled in classB (not classA) does NOT see test assigned to classA
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import {
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext, login } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  const subject = await prisma.subject.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!subject) throw new Error(`No subject for org ${orgId}`);
  return subject.id;
}

async function createClassSection(
  prisma: PrismaService,
  orgId: string,
  yearId: string,
): Promise<string> {
  const section = await prisma.classSection.create({
    data: {
      orgId,
      yearId,
      section: `${Date.now()}${Math.floor(Math.random() * 9999)}`,
      grade: SchoolGrade.GRADE_5,
    },
    select: { id: true },
  });
  return section.id;
}

describe('Test Flow Hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const allOrgIds: string[] = [];
  const allUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    // Ensure at least one CatalogSubject exists so that auto-provisioning
    // creates a Subject for every test org created via setupOrgContext.
    await prisma.catalogSubject.upsert({
      where: { code: 'MAT' },
      update: {},
      create: { code: 'MAT', name: 'Matematika' },
    });
  });

  afterAll(async () => {
    // Clean up test data in dependency-safe order.
    for (const orgId of allOrgIds) {
      // Unlock submissions (clear submitted_at) so the response lock trigger
      // doesn't block the DELETE on the responses table.
      await prisma.submission.updateMany({
        where: { organizationId: orgId },
        data: { submittedAt: null },
      });
      await prisma.response.deleteMany({
        where: { submission: { organizationId: orgId } },
      });
      await prisma.submission.deleteMany({ where: { organizationId: orgId } });
      await prisma.assignment.deleteMany({ where: { organizationId: orgId } });
      await prisma.question.deleteMany({ where: { test: { organizationId: orgId } } });
      await prisma.test.deleteMany({ where: { organizationId: orgId } });
      await prisma.enrollment.deleteMany({ where: { orgId: orgId } });
      await prisma.classSection.deleteMany({ where: { orgId } });
      await prisma.student.deleteMany({ where: { orgId } });
      await prisma.subjectLevel.deleteMany({ where: { subject: { organizationId: orgId } } });
      await prisma.subject.deleteMany({ where: { organizationId: orgId } });
      await prisma.academicYear.deleteMany({ where: { orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (allUserIds.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: allUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── Test A ────────────────────────────────────────────────────────────────
  describe('A — publish hardening', () => {
    let directorToken: string;
    let orgId: string;
    let subjectId: string;
    let yearId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_a_${ts}`,
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);

      await activateOrg(prisma, orgId);
      yearId = await getActiveYear(prisma, orgId);
      subjectId = await getSubject(prisma, orgId);
      // Org readiness guard requires at least one class section before allowing publish.
      await createClassSection(prisma, orgId, yearId);
    });

    it('A1 — publish a test with no questions → 409 TEST_NOT_ASSIGNABLE', async () => {
      const created = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Empty Test A1', subjectId, academicYearId: yearId })
        .expect(201);

      const testId = unwrap(created).id as string;

      const res = await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(409);

      expect(res.body.code ?? res.body.errorCode ?? res.body.message).toMatch(
        /TEST_NOT_ASSIGNABLE/,
      );
    });

    it('A2 — publish a test when subject is inactive → 400 TEST_NOT_ASSIGNABLE', async () => {
      // Create a subject specifically for this test so we can deactivate it
      const extraSubject = await prisma.subject.create({
        data: { organizationId: orgId, name: `Inactive Subject ${Date.now()}` },
        select: { id: true },
      });

      const created = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Inactive Subj Test A2', subjectId: extraSubject.id, academicYearId: yearId })
        .expect(201);

      const testId = unwrap(created).id as string;

      // Add a valid question with correct answer
      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          text: 'What is 2+2?',
          type: QuestionType.FILL_IN_THE_BLANK,
          score: 5,
          correctAnswer: 'four',
        })
        .expect(201);

      // Deactivate subject
      await request(app.getHttpServer())
        .patch(`/subjects/${extraSubject.id}/activation`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ isActive: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(400);

      expect(res.body.code ?? res.body.message).toMatch(/TEST_NOT_ASSIGNABLE/);
    });
  });

  // ── Test B ────────────────────────────────────────────────────────────────
  describe('B — assign hardening', () => {
    let directorToken: string;
    let orgId: string;
    let subjectId: string;
    let year1Id: string;
    let year2Id: string;
    let draftTestId: string;
    let publishedTestId: string;
    let class1Id: string;
    let class2Id: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_b_${ts}`,
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);

      await activateOrg(prisma, orgId);
      year1Id = await getActiveYear(prisma, orgId);
      subjectId = await getSubject(prisma, orgId);

      // Create a second academic year
      const year2 = await prisma.academicYear.create({
        data: {
          orgId,
          label: `Year2-${ts}`,
          startsAt: new Date('2027-09-01'),
          endsAt: new Date('2028-06-30'),
          isCurrent: false,
        },
        select: { id: true },
      });
      year2Id = year2.id;

      // Create classes in each year
      class1Id = await createClassSection(prisma, orgId, year1Id);
      class2Id = await createClassSection(prisma, orgId, year2Id);

      // Create a DRAFT test in year1
      const draftRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Draft Test B', subjectId, academicYearId: year1Id })
        .expect(201);
      draftTestId = unwrap(draftRes).id as string;

      // Create + publish a test also in year1
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Published Test B', subjectId, academicYearId: year1Id })
        .expect(201);
      publishedTestId = unwrap(testRes).id as string;

      // Add a scorable question
      await request(app.getHttpServer())
        .post(`/tests/${publishedTestId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          text: 'MCQ?',
          type: QuestionType.FILL_IN_THE_BLANK,
          score: 4,
          correctAnswer: 'yes',
        })
        .expect(201);

      // Publish
      await request(app.getHttpServer())
        .patch(`/tests/${publishedTestId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);
    });

    const assignPayload = (testId: string, classSectionId: string) => ({
      classSectionId,
      openAt: new Date(Date.now() - 60_000).toISOString(),
      closeAt: new Date(Date.now() + 86_400_000).toISOString(),
      maxAttempts: 1,
      shuffle: false,
      showExplain: 'never',
    });

    it('B1 — assign DRAFT test → 400 TEST_NOT_PUBLISHED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/tests/${draftTestId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(assignPayload(draftTestId, class1Id))
        .expect(400);

      expect(res.body.code ?? res.body.message).toMatch(/TEST_NOT_PUBLISHED/);
    });

    it('B2 — assign published test to class from different year → 400 YEAR_MISMATCH', async () => {
      // publishedTestId is in year1, class2Id is in year2
      const res = await request(app.getHttpServer())
        .post(`/tests/${publishedTestId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(assignPayload(publishedTestId, class2Id))
        .expect(400);

      expect(res.body.code ?? res.body.message).toMatch(/YEAR_MISMATCH/);
    });

    it('B3 — assign published test to correct year class → 201', async () => {
      await request(app.getHttpServer())
        .post(`/tests/${publishedTestId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(assignPayload(publishedTestId, class1Id))
        .expect(201);
    });
  });

  // ── Test C ────────────────────────────────────────────────────────────────
  describe('C — submission snapshot integrity', () => {
    let directorToken: string;
    let studentToken: string;
    let orgId: string;
    let testId: string;
    let questionId: string;
    let assignmentId: string;
    let submissionId: string;
    let studentMembershipId: string;

    const CORRECT_ANSWER = 'Paris';
    const QUESTION_SCORE = 10;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_c_${ts}`,
        with: { student: true },
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.student) allUserIds.push(ctx.student.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);
      const classSectionId = await createClassSection(prisma, orgId, yearId);

      // Enroll student
      const studentMembership = ctx.student!.membership;
      studentMembershipId = studentMembership.id as string;

      const student = await prisma.student.upsert({
        where: { membershipId: studentMembershipId },
        update: {},
        create: { membershipId: studentMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test with one MC question
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Snapshot Test C', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      const qRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          text: 'What is the capital of France?',
          type: QuestionType.FILL_IN_THE_BLANK,
          score: QUESTION_SCORE,
          correctAnswer: CORRECT_ANSWER,
        })
        .expect(201);
      questionId = unwrap(qRes).id as string;

      // Publish
      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      // Assign
      const assignRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);
      assignmentId = unwrap(assignRes).id as string;

      // Get student token scoped to this org
      studentToken = await login(app, {
        email: ctx.student!.login.email,
        password: ctx.student!.login.password,
        organizationId: orgId,
      });

      // Create submission
      const subRes = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ assignmentId })
        .expect(201);
      submissionId = unwrap(subRes).id as string;
    });

    it('C1 — finish submission with correct answer, response has awardedPoints=QUESTION_SCORE', async () => {
      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          responses: [{ questionId, givenText: CORRECT_ANSWER }],
        })
        .expect(200);

      // Verify DB snapshot fields
      const response = await prisma.response.findFirst({
        where: { submissionId, questionId },
        select: {
          isCorrect: true,
          awardedPoints: true,
          maxPoints: true,
          correctAnswerSnapshot: true,
          questionTextSnapshot: true,
        },
      });
      expect(response).not.toBeNull();
      expect(response!.isCorrect).toBe(true);
      expect(response!.awardedPoints).toBe(QUESTION_SCORE);
      expect(response!.maxPoints).toBe(QUESTION_SCORE);
      expect(response!.correctAnswerSnapshot).toBe(CORRECT_ANSWER);
      expect(response!.questionTextSnapshot).toBe('What is the capital of France?');
    });

    it('C2 — GET /tests/:id/results/:studentId returns answer breakdown with snapshot fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentMembershipId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      const body = unwrap(res);
      expect(body.totalPoints).toBe(QUESTION_SCORE);
      expect(body.answers).toHaveLength(1);
      expect(body.answers[0].correctAnswerSnapshot).toBe(CORRECT_ANSWER);
      expect(body.answers[0].awardedPoints).toBe(QUESTION_SCORE);
      expect(body.answers[0].maxPoints).toBe(QUESTION_SCORE);
      expect(body.answers[0].questionTextSnapshot).toBe('What is the capital of France?');
    });
  });

  // ── Test D ────────────────────────────────────────────────────────────────
  describe('D — tenant isolation: student cannot see tests from another org', () => {
    let studentTokenOrg1: string;
    let orgId1: string;
    let orgId2: string;
    let testIdOrg2: string;

    beforeAll(async () => {
      const ts = Date.now();

      // Org1 with a student
      const ctx1 = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_d1_${ts}`,
        with: { student: true },
      });
      orgId1 = ctx1.organization.id;
      allOrgIds.push(orgId1);
      allUserIds.push(ctx1.owner.user.id);
      if (ctx1.student) allUserIds.push(ctx1.student.user.id);
      await activateOrg(prisma, orgId1);

      // Org2 with a published test
      const ctx2 = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_d2_${ts}`,
      });
      orgId2 = ctx2.organization.id;
      allOrgIds.push(orgId2);
      allUserIds.push(ctx2.owner.user.id);
      await activateOrg(prisma, orgId2);

      const yearId2 = await getActiveYear(prisma, orgId2);
      const subjectId2 = await getSubject(prisma, orgId2);
      await createClassSection(prisma, orgId2, yearId2);

      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({ title: 'Org2 Secret Test', subjectId: subjectId2, academicYearId: yearId2 })
        .expect(201);
      testIdOrg2 = unwrap(testRes).id as string;

      // Publish org2 test
      await request(app.getHttpServer())
        .post(`/tests/${testIdOrg2}/questions`)
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({
          text: 'Org2 question?',
          type: QuestionType.FILL_IN_THE_BLANK,
          score: 1,
          correctAnswer: 'yes',
        })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tests/${testIdOrg2}`)
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      // Get student token scoped to org1
      studentTokenOrg1 = await login(app, {
        email: ctx1.student!.login.email,
        password: ctx1.student!.login.password,
        organizationId: orgId1,
      });
    });

    it('D1 — student GET /tests list does not include tests from other org', async () => {
      const res = await request(app.getHttpServer())
        .get('/tests')
        .set('Authorization', `Bearer ${studentTokenOrg1}`)
        .expect(200);

      const body = unwrap(res);
      const items: any[] = body?.items ?? body ?? [];
      const found = items.find((t: any) => t.id === testIdOrg2);
      expect(found).toBeUndefined();
    });

    it('D2 — student GET /tests/:id for cross-org test → 404', async () => {
      await request(app.getHttpServer())
        .get(`/tests/${testIdOrg2}`)
        .set('Authorization', `Bearer ${studentTokenOrg1}`)
        .expect(404);
    });
  });

  // ── Test E — Publish race condition ───────────────────────────────────────
  describe('E — publish race: concurrent PATCH status=PUBLISHED, one must get 409', () => {
    let directorToken: string;
    let orgId: string;
    let testId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_e_${ts}`,
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);
      await createClassSection(prisma, orgId, yearId);

      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Race Test E', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      // Add a scorable question
      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          text: 'Race question?',
          type: QuestionType.FILL_IN_THE_BLANK,
          score: 2,
          correctAnswer: 'yes',
        })
        .expect(201);
    });

    it('E1 — two concurrent PUBLISH requests: exactly one succeeds, other gets 409 ALREADY_PUBLISHED', async () => {
      const publish = () =>
        request(app.getHttpServer())
          .patch(`/tests/${testId}`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ status: PublishStatus.PUBLISHED });

      const [r1, r2] = await Promise.all([publish(), publish()]);

      const statuses = [r1.status, r2.status].sort();
      // One must be 200, the other 409
      expect(statuses).toEqual([200, 409]);

      // The 409 must carry ALREADY_PUBLISHED error code
      const failed = r1.status === 409 ? r1 : r2;
      expect(failed.body.code ?? failed.body.errorCode ?? failed.body.message).toMatch(
        /ALREADY_PUBLISHED/,
      );

      // DB must have exactly one PUBLISHED record
      const test = await prisma.test.findUnique({
        where: { id: testId },
        select: { status: true, publishedAt: true },
      });
      expect(test?.status).toBe(PublishStatus.PUBLISHED);
      expect(test?.publishedAt).not.toBeNull();
    });
  });

  // ── Test F — Cross-org result access ─────────────────────────────────────
  describe('F — cross-org teacher cannot view another org test results', () => {
    let teacherTokenOrg1: string;
    let orgId1: string;
    let orgId2: string;
    let testIdOrg2: string;
    let studentMembershipIdOrg2: string;

    beforeAll(async () => {
      const ts = Date.now();

      // Org1: director who will try to access org2 data
      const ctx1 = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_f1_${ts}`,
      });
      orgId1 = ctx1.organization.id;
      allOrgIds.push(orgId1);
      allUserIds.push(ctx1.owner.user.id);
      await activateOrg(prisma, orgId1);
      teacherTokenOrg1 = ctx1.owner.accessToken;
      // Org readiness requires a class section — add one so the guard doesn't short-circuit.
      const yearId1 = await getActiveYear(prisma, orgId1);
      await createClassSection(prisma, orgId1, yearId1);

      // Org2: has a test + a student submission
      const ctx2 = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_f2_${ts}`,
        with: { student: true },
      });
      orgId2 = ctx2.organization.id;
      allOrgIds.push(orgId2);
      allUserIds.push(ctx2.owner.user.id);
      if (ctx2.student) allUserIds.push(ctx2.student.user.id);
      await activateOrg(prisma, orgId2);

      const yearId2 = await getActiveYear(prisma, orgId2);
      const subjectId2 = await getSubject(prisma, orgId2);
      const classSectionId2 = await createClassSection(prisma, orgId2, yearId2);

      // Enroll student in org2
      const studentMembership2 = ctx2.student!.membership;
      studentMembershipIdOrg2 = studentMembership2.id as string;
      const student2 = await prisma.student.upsert({
        where: { membershipId: studentMembershipIdOrg2 },
        update: {},
        create: { membershipId: studentMembershipIdOrg2, orgId: orgId2 },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: student2.id,
          classSectionId: classSectionId2,
          orgId: orgId2,
          yearId: yearId2,
          status: 'ACTIVE',
        },
      });

      // Create + publish test in org2
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({ title: 'Org2 Test F', subjectId: subjectId2, academicYearId: yearId2 })
        .expect(201);
      testIdOrg2 = unwrap(testRes).id as string;

      await request(app.getHttpServer())
        .post(`/tests/${testIdOrg2}/questions`)
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({ text: 'Q?', type: QuestionType.FILL_IN_THE_BLANK, score: 1, correctAnswer: 'y' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tests/${testIdOrg2}`)
        .set('Authorization', `Bearer ${ctx2.owner.accessToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);
    });

    it('F1 — org1 director GET /tests/:org2testId/results/:studentId → 403 or 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testIdOrg2}/results/${studentMembershipIdOrg2}`)
        .set('Authorization', `Bearer ${teacherTokenOrg1}`)
        .expect((r) => {
          expect([403, 404]).toContain(r.status);
        });
      void res;
    });

    it('F2 — org1 director GET /tests/:org2testId/results → cannot see org2 submissions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testIdOrg2}/results`)
        .set('Authorization', `Bearer ${teacherTokenOrg1}`);

      // Either 403/404 or empty items — cross-org data must not leak
      if (res.status === 200) {
        const body = unwrap(res);
        const items: any[] = body?.items ?? [];
        expect(items).toHaveLength(0);
      } else {
        expect([403, 404]).toContain(res.status);
      }
    });
  });

  // ── Test G — Snapshot immutability after question edit ────────────────────
  describe('G — snapshot immutability: editing question text/answer after submit does not change snapshot', () => {
    let directorToken: string;
    let studentToken: string;
    let orgId: string;
    let testId: string;
    let questionId: string;
    let submissionId: string;
    let studentMembershipId: string;

    const ORIGINAL_QUESTION_TEXT = 'What is the capital of Germany?';
    const ORIGINAL_CORRECT_ANSWER = 'Berlin';

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_g_${ts}`,
        with: { student: true },
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.student) allUserIds.push(ctx.student.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);
      const classSectionId = await createClassSection(prisma, orgId, yearId);

      // Enroll student
      studentMembershipId = ctx.student!.membership.id as string;
      const student = await prisma.student.upsert({
        where: { membershipId: studentMembershipId },
        update: {},
        create: { membershipId: studentMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test + question
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Snapshot Immutability Test G', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      const qRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          text: ORIGINAL_QUESTION_TEXT,
          type: QuestionType.FILL_IN_THE_BLANK,
          score: 5,
          correctAnswer: ORIGINAL_CORRECT_ANSWER,
        })
        .expect(201);
      questionId = unwrap(qRes).id as string;

      // Publish + assign
      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      const assignRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);
      const assignmentId = unwrap(assignRes).id as string;

      // Student creates + finishes submission
      studentToken = await login(app, {
        email: ctx.student!.login.email,
        password: ctx.student!.login.password,
        organizationId: orgId,
      });

      const subRes = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ assignmentId })
        .expect(201);
      submissionId = unwrap(subRes).id as string;

      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses: [{ questionId, givenText: ORIGINAL_CORRECT_ANSWER }] })
        .expect(200);

      // Now mutate the question text and correct answer via direct DB (post-submit)
      await prisma.question.update({
        where: { id: questionId },
        data: {
          text: 'Completely different question text!',
          correctAnswer: 'Warsaw',
        },
      });
    });

    it('G1 — DB snapshot fields are unchanged after question mutation', async () => {
      const response = await prisma.response.findFirst({
        where: { submissionId, questionId },
        select: {
          questionTextSnapshot: true,
          correctAnswerSnapshot: true,
          isCorrect: true,
        },
      });
      expect(response).not.toBeNull();
      // Snapshots must reflect state at submit time — not the mutated question
      expect(response!.questionTextSnapshot).toBe(ORIGINAL_QUESTION_TEXT);
      expect(response!.correctAnswerSnapshot).toBe(ORIGINAL_CORRECT_ANSWER);
      // Score was computed at submit time — still correct
      expect(response!.isCorrect).toBe(true);
    });

    it('G2 — GET /tests/:id/results/:studentId returns original snapshot text', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentMembershipId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      const body = unwrap(res);
      expect(body.answers).toHaveLength(1);
      // API must serve the snapshot, not the current live question text
      expect(body.answers[0].questionTextSnapshot).toBe(ORIGINAL_QUESTION_TEXT);
      expect(body.answers[0].correctAnswerSnapshot).toBe(ORIGINAL_CORRECT_ANSWER);
    });
  });

  // ── Tests H & I — class-scoped result authorization ───────────────────────
  describe('H/I — teacher vs director class-scoped result access', () => {
    let directorToken: string;
    let teacherAToken: string;
    let orgId: string;
    let testId: string;
    let studentBMembershipId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_hi_${ts}`,
        with: { teacher: true },
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.teacher) allUserIds.push(ctx.teacher.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);

      // Create Teacher record for the teacher membership so the class can be assigned.
      const teacherMembershipId = ctx.teacher!.membership.id as string;
      const teacherRecord = await prisma.teacher.upsert({
        where: { membershipId: teacherMembershipId },
        update: {},
        create: { membershipId: teacherMembershipId, organizationId: orgId },
        select: { id: true },
      });

      // classA — teacherA's homeroom.
      await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `A${ts}`,
          grade: SchoolGrade.GRADE_5,
          teacherId: teacherRecord.id,
        },
        select: { id: true },
      });

      // classB — no homeroom teacher (teacherA is NOT homeroom here).
      const classB = await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `B${ts}`,
          grade: SchoolGrade.GRADE_6,
        },
        select: { id: true },
      });

      // studentB enrolled in classB.
      const studentBCtx = await ctx.addMember(OrganizationRole.STUDENT, `studentB_${ts}`);
      allUserIds.push(studentBCtx.user.id);
      studentBMembershipId = studentBCtx.membership.id as string;

      const studentBRecord = await prisma.student.upsert({
        where: { membershipId: studentBMembershipId },
        update: {},
        create: { membershipId: studentBMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: studentBRecord.id,
          classSectionId: classB.id,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test, add question, publish, assign to classB.
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Class-Scope Test HI', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ text: 'Q?', type: QuestionType.FILL_IN_THE_BLANK, score: 1, correctAnswer: 'y' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      const assignRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId: classB.id,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);
      const assignmentId = unwrap(assignRes).id as string;

      // studentB submits the test.
      const studentBToken = await login(app, {
        email: studentBCtx.login.email,
        password: studentBCtx.login.password,
        organizationId: orgId,
      });
      const subRes = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ assignmentId })
        .expect(201);
      const submissionId = unwrap(subRes).id as string;

      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ responses: [] })
        .expect(200);

      // TeacherA token scoped to org.
      teacherAToken = await login(app, {
        email: ctx.teacher!.login.email,
        password: ctx.teacher!.login.password,
        organizationId: orgId,
      });
    });

    it('H1 — teacherA (homeroom classA) GET /tests/:id/results/:studentB → 403 NOT_YOUR_CLASS', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentBMembershipId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(403);

      expect(res.body.code ?? res.body.message).toMatch(/NOT_YOUR_CLASS/);
    });

    it('I1 — director GET /tests/:id/results/:studentB → 200 (sees all students in org)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentBMembershipId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(unwrap(res).submissionId).toBeDefined();
    });
  });

  // ── Test K — teacher with TeacherClassSection (non-homeroom) is allowed ──
  describe('K — teacher explicitly assigned to a non-homeroom class can view student results', () => {
    let teacherToken: string;
    let directorToken: string;
    let orgId: string;
    let testId: string;
    let studentMembershipId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_k_${ts}`,
        with: { teacher: true, student: true },
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.teacher) allUserIds.push(ctx.teacher.user.id);
      if (ctx.student) allUserIds.push(ctx.student.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);

      // Teacher has NO homeroom class.
      const teacherMembershipId = ctx.teacher!.membership.id as string;
      const teacherRecord = await prisma.teacher.upsert({
        where: { membershipId: teacherMembershipId },
        update: {},
        create: { membershipId: teacherMembershipId, organizationId: orgId },
        select: { id: true },
      });

      // classB — no homeroom teacher, but teacher will be explicitly assigned to teach it.
      const classB = await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `KB${ts}`,
          grade: SchoolGrade.GRADE_6,
        },
        select: { id: true },
      });

      // Explicitly assign teacher to classB via TeacherClassSection.
      await prisma.teacherClassSection.create({
        data: { teacherId: teacherRecord.id, classSectionId: classB.id },
      });

      // Enroll student in classB.
      studentMembershipId = ctx.student!.membership.id as string;
      const studentRecord = await prisma.student.upsert({
        where: { membershipId: studentMembershipId },
        update: {},
        create: { membershipId: studentMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: studentRecord.id,
          classSectionId: classB.id,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test, publish, assign to classB, student submits.
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'TeacherClassSection Test K', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ text: 'Q?', type: QuestionType.FILL_IN_THE_BLANK, score: 1, correctAnswer: 'y' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      const assignRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId: classB.id,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);
      const assignmentId = unwrap(assignRes).id as string;

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

      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses: [] })
        .expect(200);

      teacherToken = await login(app, {
        email: ctx.teacher!.login.email,
        password: ctx.teacher!.login.password,
        organizationId: orgId,
      });
    });

    it('K1 — teacher (no homeroom, but TeacherClassSection for classB) GET results/:studentId → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentMembershipId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(unwrap(res).submissionId).toBeDefined();
    });

    it('K2 — teacher sees student in GET /tests/:id/results list → not empty', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = unwrap(res);
      const items: any[] = body?.items ?? [];
      expect(items.length).toBeGreaterThan(0);
    });
  });

  // ── Test J — SUPERADMIN bypasses class-scope guard ────────────────────────
  describe('J — superadmin bypasses class-scope guard', () => {
    let superadminToken: string;
    let directorToken: string;
    let orgId: string;
    let testId: string;
    let studentMembershipId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_j_${ts}`,
        with: { student: true, superadmin: true },
      });
      orgId = ctx.organization.id;
      directorToken = ctx.owner.accessToken;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.student) allUserIds.push(ctx.student.user.id);
      if (ctx.superadmin) allUserIds.push(ctx.superadmin.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);

      // A class with NO homeroom teacher assigned.
      const classSection = await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `J${ts}`,
          grade: SchoolGrade.GRADE_7,
        },
        select: { id: true },
      });

      // Enroll the student.
      studentMembershipId = ctx.student!.membership.id as string;
      const studentRecord = await prisma.student.upsert({
        where: { membershipId: studentMembershipId },
        update: {},
        create: { membershipId: studentMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: studentRecord.id,
          classSectionId: classSection.id,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test, publish, assign, student submits.
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Class-Scope Test J', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ text: 'Q?', type: QuestionType.FILL_IN_THE_BLANK, score: 1, correctAnswer: 'y' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      const assignRes = await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId: classSection.id,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);
      const assignmentId = unwrap(assignRes).id as string;

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

      await request(app.getHttpServer())
        .post(`/submissions/${submissionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ responses: [] })
        .expect(200);

      // SUPERADMIN scoped to this org (they have membership via setupOrgContext).
      superadminToken = await login(app, {
        email: ctx.superadmin!.login.email,
        password: ctx.superadmin!.login.password,
        organizationId: orgId,
      });
    });

    it('J1 — superadmin GET /tests/:id/results/:studentId → 200 (bypasses class-scope guard)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tests/${testId}/results/${studentMembershipId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(unwrap(res).submissionId).toBeDefined();
    });
  });

  // ── Tests L & M — student visibility scoped to enrolled class ─────────────
  describe('L/M — student sees test assigned to their class; other-class student does not', () => {
    let studentAToken: string;
    let studentBToken: string;
    let orgId: string;
    let testId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const ctx = await setupOrgContext(app, prisma, {
        role: 'DIRECTOR',
        seed: `flw_lm_${ts}`,
        with: { student: true },
      });
      orgId = ctx.organization.id;
      allOrgIds.push(orgId);
      allUserIds.push(ctx.owner.user.id);
      if (ctx.student) allUserIds.push(ctx.student.user.id);

      await activateOrg(prisma, orgId);
      const yearId = await getActiveYear(prisma, orgId);
      const subjectId = await getSubject(prisma, orgId);

      // classA — where the test will be assigned.
      const classA = await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `LA${ts}`,
          grade: SchoolGrade.GRADE_7,
        },
        select: { id: true },
      });

      // classB — different class, no assignment to this class.
      const classB = await prisma.classSection.create({
        data: {
          orgId,
          yearId,
          section: `LB${ts}`,
          grade: SchoolGrade.GRADE_8,
        },
        select: { id: true },
      });

      // studentA enrolled in classA.
      const studentAMembershipId = ctx.student!.membership.id as string;
      const studentARecord = await prisma.student.upsert({
        where: { membershipId: studentAMembershipId },
        update: {},
        create: { membershipId: studentAMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: studentARecord.id,
          classSectionId: classA.id,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // studentB — separate member enrolled only in classB.
      const studentBCtx = await ctx.addMember(OrganizationRole.STUDENT, `studentB_lm_${ts}`);
      allUserIds.push(studentBCtx.user.id);
      const studentBMembershipId = studentBCtx.membership.id as string;
      const studentBRecord = await prisma.student.upsert({
        where: { membershipId: studentBMembershipId },
        update: {},
        create: { membershipId: studentBMembershipId, orgId },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: studentBRecord.id,
          classSectionId: classB.id,
          orgId,
          yearId,
          status: 'ACTIVE',
        },
      });

      // Create test, publish, assign ONLY to classA.
      const directorToken = ctx.owner.accessToken;
      const testRes = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ title: 'Class Visibility Test LM', subjectId, academicYearId: yearId })
        .expect(201);
      testId = unwrap(testRes).id as string;

      await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ text: 'Q?', type: QuestionType.FILL_IN_THE_BLANK, score: 1, correctAnswer: 'y' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: PublishStatus.PUBLISHED })
        .expect(200);

      // Assign to classA only — classB students must NOT see this test.
      await request(app.getHttpServer())
        .post(`/tests/${testId}/assign`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          classSectionId: classA.id,
          openAt: new Date(Date.now() - 60_000).toISOString(),
          closeAt: new Date(Date.now() + 86_400_000).toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        })
        .expect(201);

      studentAToken = await login(app, {
        email: ctx.student!.login.email,
        password: ctx.student!.login.password,
        organizationId: orgId,
      });
      studentBToken = await login(app, {
        email: studentBCtx.login.email,
        password: studentBCtx.login.password,
        organizationId: orgId,
      });
    });

    it('L1 — studentA (enrolled in classA) GET /tests → test is visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/tests')
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(200);

      const body = unwrap(res);
      const items: any[] = body?.items ?? body ?? [];
      const found = items.find((t: any) => t.id === testId);
      expect(found).toBeDefined();
    });

    it('M1 — studentB (enrolled in classB, not classA) GET /tests → test is NOT visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/tests')
        .set('Authorization', `Bearer ${studentBToken}`)
        .expect(200);

      const body = unwrap(res);
      const items: any[] = body?.items ?? body ?? [];
      const found = items.find((t: any) => t.id === testId);
      expect(found).toBeUndefined();
    });
  });
});
