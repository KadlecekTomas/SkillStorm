import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { OrganizationRole, OrganizationStatus, QuestionType } from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

describe('Tests detail sanitization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let directorToken = '';
  let studentToken = '';
  let orgId = '';
  let testId = '';

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
      seed: 'test_detail_sanitization_director',
      name: 'Sanitization Director',
    });
    const student = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'test_detail_sanitization_student',
      name: 'Sanitization Student',
    });

    orgId = director.organization.id;
    directorToken = director.accessToken;

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: student.user.id,
          organizationId: orgId,
        },
      },
      update: {
        role: OrganizationRole.STUDENT,
        deletedAt: null,
      },
      create: {
        userId: student.user.id,
        organizationId: orgId,
        role: OrganizationRole.STUDENT,
      },
    });
    studentToken = await useOrg(app, student.accessToken, orgId);

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const currentYear = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!currentYear) {
      await prisma.academicYear.create({
        data: {
          orgId,
          label: `sanitized_${Date.now()}`,
          startsAt: new Date('2025-09-01T00:00:00.000Z'),
          endsAt: new Date('2026-06-30T23:59:59.000Z'),
          isCurrent: true,
        },
      });
    }

    const created = await prisma.test.create({
      data: {
        title: 'Sanitization sample test',
        organizationId: orgId,
        creatorId: director.membership.id,
      },
      select: { id: true },
    });
    testId = created.id;

    const question = await prisma.question.create({
      data: {
        testId,
        text: 'Sanitize this',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
        correctAnswers: ['true'],
        order: 1,
      },
      select: { id: true },
    });

    await prisma.answer.create({
      data: {
        questionId: question.id,
        text: 'true',
      },
    });
  });

  afterAll(async () => {
    await prisma.answer.deleteMany({
      where: { question: { testId } },
    }).catch(() => {});
    await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: testId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('student GET /tests/:id does not include answer keys; director still sees them', async () => {
    const studentRes = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const studentPayload = studentRes.body?.data ?? studentRes.body;
    expect(Array.isArray(studentPayload?.questions)).toBe(true);
    expect(studentPayload.questions.length).toBeGreaterThan(0);
    for (const question of studentPayload.questions as Array<Record<string, unknown>>) {
      expect(question).not.toHaveProperty('correctAnswer');
      expect(question).not.toHaveProperty('correctAnswers');
      expect(question).not.toHaveProperty('answers');
    }

    const directorRes = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    const directorPayload = directorRes.body?.data ?? directorRes.body;
    expect(Array.isArray(directorPayload?.questions)).toBe(true);
    expect(directorPayload.questions.length).toBeGreaterThan(0);
    expect(directorPayload.questions[0]).toHaveProperty('correctAnswer');
    expect(directorPayload.questions[0]).toHaveProperty('correctAnswers');
    expect(directorPayload.questions[0]).toHaveProperty('answers');
  });
});
