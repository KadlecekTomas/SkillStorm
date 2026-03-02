import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import {
  EnrollmentStatus,
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

const BANNED_KEYS = new Set(['correctAnswer', 'correctAnswers', 'answers']);

function assertNoAnswerKeyKeys(
  value: unknown,
  visited: WeakSet<object> = new WeakSet<object>(),
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoAnswerKeyKeys(entry, visited));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);
  const obj = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(obj)) {
    expect(BANNED_KEYS.has(key)).toBe(false);
    assertNoAnswerKeyKeys(nested, visited);
  }
}

describe('Tests answer-key regression (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId = '';
  let studentToken = '';
  let testId = '';
  let classSectionId = '';
  let assignmentId = '';
  let studentMembershipId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const director = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'tests_answer_key_reg_director',
      name: 'AnswerKey Director',
    });
    const student = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'tests_answer_key_reg_student',
      name: 'AnswerKey Student',
    });

    orgId = director.organization.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const studentMembership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: student.user.id,
          organizationId: orgId,
        },
      },
      update: { role: OrganizationRole.STUDENT, deletedAt: null },
      create: {
        userId: student.user.id,
        organizationId: orgId,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    studentMembershipId = studentMembership.id;
    studentToken = await useOrg(app, student.accessToken, orgId);

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) throw new Error('Missing current academic year');

    await prisma.student.upsert({
      where: { membershipId: studentMembershipId },
      update: { orgId, deletedAt: null },
      create: { membershipId: studentMembershipId, orgId },
    });
    const studentRow = await prisma.student.findUnique({
      where: { membershipId: studentMembershipId },
      select: { id: true },
    });
    if (!studentRow) throw new Error('Missing student row');

    const cls = await prisma.classSection.create({
      data: {
        orgId,
        yearId: year.id,
        grade: SchoolGrade.GRADE_8,
        section: `AK-${Date.now()}`,
        label: 'AnswerKey Class',
      },
      select: { id: true },
    });
    classSectionId = cls.id;

    await prisma.enrollment.create({
      data: {
        studentId: studentRow.id,
        classSectionId,
        yearId: year.id,
        orgId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    const createdTest = await prisma.test.create({
      data: {
        title: 'Answer-key regression test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    testId = createdTest.id;

    const question = await prisma.question.create({
      data: {
        testId,
        text: 'Regression question',
        type: QuestionType.TRUE_FALSE,
        order: 1,
        score: 1,
        correctAnswer: 'true',
        correctAnswers: ['true'],
      },
      select: { id: true },
    });
    await prisma.answer.create({
      data: {
        questionId: question.id,
        text: 'true',
      },
    });

    const now = new Date();
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year.id,
        testId,
        targetType: 'CLASS',
        classSectionId,
        openAt: new Date(now.getTime() - 30 * 60 * 1000),
        closeAt: new Date(now.getTime() + 30 * 60 * 1000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_close',
        createdById: director.membership.id,
      },
      select: { id: true },
    });
    assignmentId = assignment.id;
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { assignmentId } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    await prisma.answer.deleteMany({ where: { question: { testId } } }).catch(() => {});
    await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: testId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { membershipId: studentMembershipId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('student responses across /tests surface never contain answer-key fields', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    assertNoAnswerKeyKeys(listRes.body?.data ?? listRes.body);

    const detailRes = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    assertNoAnswerKeyKeys(detailRes.body?.data ?? detailRes.body);

    const resultsRes = await request(app.getHttpServer())
      .get(`/tests/${testId}/results`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    assertNoAnswerKeyKeys(resultsRes.body?.data ?? resultsRes.body);
  });
});
