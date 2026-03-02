import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { EnrollmentStatus, OrganizationRole, OrganizationStatus, PublishStatus, QuestionType, SchoolGrade } from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

describe('Tests detail sanitization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let directorToken = '';
  let studentToken = '';
  let orgId = '';
  let testId = '';
  let unpublishedTestId = '';
  let softDeletedTestId = '';
  let classSectionId = '';
  let studentMembershipId = '';
  let assignmentId = '';

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
    const studentMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: student.user.id,
          organizationId: orgId,
        },
      },
      select: { id: true },
    });
    if (!studentMembership) {
      throw new Error('Missing student membership in org');
    }
    studentMembershipId = studentMembership.id;

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

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) {
      throw new Error('Missing current year');
    }

    await prisma.student.upsert({
      where: { membershipId: studentMembershipId },
      update: { orgId, deletedAt: null },
      create: { membershipId: studentMembershipId, orgId },
    });

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId: year.id,
        grade: SchoolGrade.GRADE_8,
        section: `S-${Date.now()}`,
        label: 'Security Class',
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const studentRow = await prisma.student.findUnique({
      where: { membershipId: studentMembershipId },
      select: { id: true },
    });
    if (!studentRow) {
      throw new Error('Missing student row');
    }

    await prisma.enrollment.upsert({
      where: { studentId_yearId: { studentId: studentRow.id, yearId: year.id } },
      update: {
        classSectionId: classSection.id,
        status: EnrollmentStatus.ACTIVE,
      },
      create: {
        studentId: studentRow.id,
        classSectionId: classSection.id,
        yearId: year.id,
        orgId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    const created = await prisma.test.create({
      data: {
        title: 'Sanitization sample test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    testId = created.id;

    const unpublished = await prisma.test.create({
      data: {
        title: 'Unpublished hidden test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.DRAFT,
      },
      select: { id: true },
    });
    unpublishedTestId = unpublished.id;

    const softDeleted = await prisma.test.create({
      data: {
        title: 'Soft deleted hidden test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
        deletedAt: new Date(),
      },
      select: { id: true },
    });
    softDeletedTestId = softDeleted.id;

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

    const openAt = new Date(Date.now() - 60 * 60 * 1000);
    const closeAt = new Date(Date.now() + 60 * 60 * 1000);
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year.id,
        testId,
        targetType: 'CLASS',
        classSectionId,
        openAt,
        closeAt,
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
    await prisma.answer.deleteMany({
      where: { question: { testId } },
    }).catch(() => {});
    await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { membershipId: studentMembershipId } }).catch(() => {});
    await prisma.test
      .deleteMany({ where: { id: { in: [testId, unpublishedTestId, softDeletedTestId] } } })
      .catch(() => {});
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

  it('student GET /tests does not list all organization tests', async () => {
    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const payload = res.body?.data ?? res.body;
    const items = payload?.items ?? [];
    const ids = items.map((item: { id: string }) => item.id);
    expect(ids).toContain(testId);
    expect(ids).not.toContain(unpublishedTestId);
  });

  it('student GET /tests/:id cannot read unpublished test', async () => {
    await request(app.getHttpServer())
      .get(`/tests/${unpublishedTestId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
  });

  it('soft-deleted test is not visible to student nor director', async () => {
    await request(app.getHttpServer())
      .get(`/tests/${softDeletedTestId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/tests/${softDeletedTestId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(404);
  });

  it('student without assignment access cannot read full test', async () => {
    const detached = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'test_detail_sanitization_detached',
      name: 'Detached Student',
    });
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: detached.user.id,
          organizationId: orgId,
        },
      },
      update: { role: OrganizationRole.STUDENT, deletedAt: null },
      create: {
        userId: detached.user.id,
        organizationId: orgId,
        role: OrganizationRole.STUDENT,
      },
    });
    const detachedMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: detached.user.id,
          organizationId: orgId,
        },
      },
      select: { id: true },
    });
    if (!detachedMembership) {
      throw new Error('Missing detached membership');
    }
    await prisma.student.upsert({
      where: { membershipId: detachedMembership.id },
      update: { orgId, deletedAt: null },
      create: { membershipId: detachedMembership.id, orgId },
    });
    const detachedToken = await useOrg(app, detached.accessToken, orgId);

    const denied = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${detachedToken}`);
    expect([403, 404]).toContain(denied.status);
  });
});
