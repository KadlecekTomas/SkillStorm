/**
 * Canary for the DB-level dependency of the submission flow.
 *
 * updateResponses()/finish() rely on TWO layers:
 *   1. app layer — SELECT ... FOR UPDATE + submittedAt check in a transaction;
 *   2. DB layer — trigger `responses_lock_after_submit` (migration
 *      20260222110000) that rejects any INSERT/UPDATE/DELETE on responses
 *      once the parent submission is submitted (SUBMISSION_LOCKED, P0001).
 *
 * The app maps the trigger error to 409; if the trigger silently disappeared
 * (dropped by a careless migration, restored from an old dump), immutability
 * of submitted answers would depend on the app layer alone. This suite fails
 * loudly in that case — both by catalog inspection and by behavior.
 */
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole } from '@prisma/client';
import { setupOrgContext } from 'test/helpers';

describe('responses_lock_after_submit trigger (DB dependency canary)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('trigger exists in the database catalog', async () => {
    const rows = await prisma.$queryRawUnsafe<{ tgname: string }[]>(`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'responses_lock_after_submit' AND NOT tgisinternal
    `);
    expect(rows.length).toBe(1);
  });

  it('enrollment org-consistency trigger exists in the database catalog', async () => {
    // companion canary for migration 20260714090000
    const rows = await prisma.$queryRawUnsafe<{ tgname: string }[]>(`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'enrollment_org_consistency' AND NOT tgisinternal
    `);
    expect(rows.length).toBe(1);
  });

  it('DB rejects direct response mutations on a submitted submission', async () => {
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `trigcanary_${Date.now()}`,
      with: { student: true },
    });
    const orgId = ctx.organization.id;
    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });

    const test = await prisma.test.create({
      data: {
        organizationId: orgId,
        title: 'Trigger canary test',
        creatorId: ctx.owner.membership.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const question = await prisma.question.create({
      data: {
        testId: test.id,
        text: '1 < 2?',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
      select: { id: true },
    });
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year!.id,
        testId: test.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.owner.membership.id,
      },
      select: { id: true },
    });
    const submission = await prisma.submission.create({
      data: {
        organizationId: orgId,
        assignmentId: assignment.id,
        studentId: ctx.student!.membership.id,
        testId: test.id,
        attemptNo: 1,
        status: $Enums.SubmissionStatus.APPROVED,
        submittedAt: new Date(), // already submitted → responses locked
      },
      select: { id: true },
    });

    // INSERT must be rejected by the trigger, not by any app code.
    await expect(
      prisma.response.create({
        data: {
          submissionId: submission.id,
          questionId: question.id,
          givenText: 'tampered',
        },
      }),
    ).rejects.toThrow(/SUBMISSION_LOCKED/);
  });
});
