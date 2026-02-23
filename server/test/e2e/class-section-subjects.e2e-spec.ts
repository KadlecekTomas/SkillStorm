import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs, useOrg } from 'test/helpers';
import { OrganizationRole, OrganizationStatus, SchoolGrade } from '@prisma/client';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('ClassSection org subjects + assign RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId = '';
  let otherOrgId = '';
  let directorToken = '';
  let teacherToken = '';
  let yearId = '';
  let classSectionId = '';
  let orgSubjectId = '';
  let foreignOrgSubjectId = '';
  let publishedTestId = '';

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
      seed: 'class_subjects_director',
      name: 'Class Subjects Director',
    });
    const teacher = await authAs(app, OrganizationRole.TEACHER, {
      seed: 'class_subjects_teacher',
      name: 'Class Subjects Teacher',
    });
    const otherDirector = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'class_subjects_other_director',
      name: 'Class Subjects Other Director',
    });

    orgId = director.organization.id;
    otherOrgId = otherDirector.organization.id;

    await prisma.organization.updateMany({
      where: { id: { in: [orgId, otherOrgId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    directorToken = await useOrg(app, director.accessToken, orgId);

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: teacher.user.id,
          organizationId: orgId,
        },
      },
      update: { role: OrganizationRole.TEACHER, deletedAt: null },
      create: {
        userId: teacher.user.id,
        organizationId: orgId,
        role: OrganizationRole.TEACHER,
      },
    });
    teacherToken = await useOrg(app, teacher.accessToken, orgId);

    const currentYear = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (currentYear) {
      yearId = currentYear.id;
    } else {
      const createdYear = await prisma.academicYear.create({
        data: {
          orgId,
          label: '2024/25',
          startsAt: new Date('2024-09-01T00:00:00.000Z'),
          endsAt: new Date('2025-06-30T00:00:00.000Z'),
          isCurrent: true,
        },
        select: { id: true },
      });
      yearId = createdYear.id;
    }

    const otherCurrentYear = await prisma.academicYear.findFirst({
      where: { orgId: otherOrgId, isCurrent: true },
      select: { id: true },
    });
    if (!otherCurrentYear) {
      await prisma.academicYear.create({
        data: {
          orgId: otherOrgId,
          label: '2024/25',
          startsAt: new Date('2024-09-01T00:00:00.000Z'),
          endsAt: new Date('2025-06-30T00:00:00.000Z'),
          isCurrent: true,
        },
      });
    }

    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: SchoolGrade.GRADE_5,
        section: `S${uniqueSuffix}`,
        label: `5.S${uniqueSuffix}`,
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const subject = await prisma.orgSubject.create({
      data: {
        name: `Matematika ${uniqueSuffix}`,
        gradeFrom: 1,
        gradeTo: 9,
        organizationId: orgId,
      },
      select: { id: true },
    });
    orgSubjectId = subject.id;

    const foreignSubject = await prisma.orgSubject.create({
      data: {
        name: `Cizí předmět ${uniqueSuffix}`,
        gradeFrom: 1,
        gradeTo: 9,
        organizationId: otherOrgId,
      },
      select: { id: true },
    });
    foreignOrgSubjectId = foreignSubject.id;

    const teacherMembership = await prisma.membership.findFirst({
      where: {
        userId: teacher.user.id,
        organizationId: orgId,
        role: OrganizationRole.TEACHER,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!teacherMembership) {
      throw new Error('Teacher membership not found for assign test setup');
    }

    const test = await prisma.test.create({
      data: {
        title: `RBAC assign test ${uniqueSuffix}`,
        organizationId: orgId,
        creatorId: teacherMembership.id,
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    publishedTestId = test.id;

    await prisma.question.create({
      data: {
        testId: test.id,
        text: 'Ano nebo ne?',
        type: 'TRUE_FALSE',
        score: 1,
        correctAnswer: 'true',
        order: 1,
      },
    });
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({ where: { testId: publishedTestId } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: publishedTestId } }).catch(() => {});
    await prisma.classSectionOrgSubject.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.orgSubject.deleteMany({ where: { id: { in: [orgSubjectId, foreignOrgSubjectId] } } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('director attaches orgSubject to class section', async () => {
    const res = await request(app.getHttpServer())
      .post(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        orgSubjectIds: [orgSubjectId],
        replaceAll: true,
      });

    expect(res.status).toBe(201);
    const body = unwrapBody(res) as Array<{ id: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((subject) => subject.id === orgSubjectId)).toBe(true);
  });

  it('list endpoint returns attached subjects', async () => {
    const res = await request(app.getHttpServer())
      .get(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(res.status).toBe(200);
    const body = unwrapBody(res) as Array<{ id: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((subject) => subject.id === orgSubjectId)).toBe(true);
  });

  it('attach foreign orgSubject is rejected (cross-org)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        orgSubjectIds: [foreignOrgSubjectId],
      });

    expect([400, 403]).toContain(res.status);
  });

  it('teacher with ASSIGN_TESTS can assign test', async () => {
    const openAt = new Date(Date.now() - 60_000).toISOString();
    const closeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await request(app.getHttpServer())
      .post(`/tests/${publishedTestId}/assign`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classSectionId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
      });

    expect(res.status).toBe(201);
    const body = unwrapBody(res) as { classSectionId: string; testId: string };
    expect(body.classSectionId).toBe(classSectionId);
    expect(body.testId).toBe(publishedTestId);
  });
});
