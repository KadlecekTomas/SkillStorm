import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs, useOrg } from 'test/helpers';
import {
  OrganizationRole,
  OrganizationStatus,
  SchoolGrade,
} from '@prisma/client';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

function uniqueValue(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

describe('Phase 1.1 hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId = '';
  let directorToken = '';
  let teacherToken = '';
  let classSectionId = '';
  let yearId = '';
  let outOfRangeSubjectId = '';

  const createOrgInvite = async (
    role: OrganizationRole = OrganizationRole.TEACHER,
  ) => {
    const res = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        type: 'ORG_ONLY',
        role,
      })
      .expect(201);
    const body = unwrapBody(res) as {
      id: string;
      inviteToken?: string;
      code?: string;
      expiresAt: string;
    };
    return body;
  };

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
      seed: 'phase11_hardening_director',
      name: 'Phase11 Director',
    });
    orgId = director.organization.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });
    directorToken = await useOrg(app, director.accessToken, orgId);

    const teacher = await authAs(app, OrganizationRole.TEACHER, {
      seed: 'phase11_hardening_teacher',
      name: 'Phase11 Teacher',
    });
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

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (year) {
      yearId = year.id;
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

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: SchoolGrade.GRADE_5,
        section: `P${Math.floor(Math.random() * 10000)}`,
        label: `5.P${Math.floor(Math.random() * 10000)}`,
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const outOfRangeSubject = await prisma.orgSubject.create({
      data: {
        organizationId: orgId,
        name: uniqueValue('OutOfRange'),
        gradeFrom: 7,
        gradeTo: 9,
      },
      select: { id: true },
    });
    outOfRangeSubjectId = outOfRangeSubject.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('invite create returns inviteToken (and keeps code for backward compatibility)', async () => {
    const invite = await createOrgInvite(OrganizationRole.TEACHER);

    expect(typeof invite.inviteToken).toBe('string');
    expect(invite.inviteToken).toBeTruthy();
    expect(typeof invite.code).toBe('string');
    expect(invite.code).toBe(invite.inviteToken);
  });

  it('JOIN_ORG register with inviteToken creates membership', async () => {
    const invite = await createOrgInvite(OrganizationRole.TEACHER);
    const inviteToken = invite.inviteToken ?? invite.code;
    expect(inviteToken).toBeTruthy();

    const email = `${uniqueValue('join_teacher').toLowerCase()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join Teacher',
        email,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken,
      })
      .expect(201);

    const body = unwrapBody(res) as {
      user: { id: string };
      membership: { id: string; organizationId: string; role: OrganizationRole };
    };
    expect(body.membership.organizationId).toBe(orgId);
    expect(body.membership.role).toBe(OrganizationRole.TEACHER);

    const membership = await prisma.membership.findUnique({
      where: { id: body.membership.id },
      select: { id: true, organizationId: true, role: true },
    });
    expect(membership?.organizationId).toBe(orgId);
    expect(membership?.role).toBe(OrganizationRole.TEACHER);
  });

  it('JOIN_ORG with invalid token returns 403 (no 500)', async () => {
    const email = `${uniqueValue('join_invalid').toLowerCase()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Invalid Join',
        email,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: 'invalid-token',
      });

    expect(res.status).toBe(403);
  });

  it('attach out-of-range subject returns 422 SUBJECT_OUT_OF_GRADE_RANGE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        orgSubjectIds: [outOfRangeSubjectId],
      });

    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('SUBJECT_OUT_OF_GRADE_RANGE');
    expect(res.body.details?.grade).toBe(5);
    expect(Array.isArray(res.body.details?.invalid)).toBe(true);
    expect(
      (res.body.details?.invalid ?? []).some(
        (entry: { orgSubjectId?: string }) =>
          entry.orgSubjectId === outOfRangeSubjectId,
      ),
    ).toBe(true);
  });

  it('assign rejects non-assignable test with 409 and accepts after question is fixed', async () => {
    const testCreate = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        title: uniqueValue('Hardening Test'),
        organizationId: orgId,
      })
      .expect(201);
    const createdTest = unwrapBody(testCreate) as { id: string };
    const testId = createdTest.id;

    const questionCreate = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Vyber jednu možnost',
        type: 'MULTIPLE_CHOICE',
        score: 1,
        order: 1,
      })
      .expect(201);
    const createdQuestion = unwrapBody(questionCreate) as { id: string };
    const questionId = createdQuestion.id;

    const openAt = new Date(Date.now() - 60_000).toISOString();
    const closeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const invalidAssign = await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        classSectionId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
      });

    expect(invalidAssign.status).toBe(409);
    expect(invalidAssign.body.errorCode).toBe('TEST_NOT_ASSIGNABLE');
    expect(invalidAssign.body.reasons).toBeDefined();
    expect(invalidAssign.body.reasons.missingCorrectAnswers).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ text: 'A' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ text: 'B' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tests/${testId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        type: 'MULTIPLE_CHOICE',
        score: 1,
        correctAnswer: 'A',
      })
      .expect(200);

    const validAssign = await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        classSectionId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
      });
    expect([200, 201]).toContain(validAssign.status);
  });

  it('teacher /auth/me permissions include ASSIGN_TESTS by defaults', async () => {
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const body = unwrapBody(me) as { permissions?: string[] };
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(body.permissions).toContain('ASSIGN_TESTS');
  });
});
