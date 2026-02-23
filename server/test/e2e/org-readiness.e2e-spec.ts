/**
 * E2E: RequireOrgReadyGuard – operation type is declared via @OrgOperation (no URL).
 * NOT_READY: AUTHORING endpoints → 200/201; EXECUTION endpoints → 412.
 * READY: all allowed (subject to RBAC).
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { setupOrgContext } from 'test/helpers';
import { getOrgReadiness } from '@/shared/org-readiness.utils';
import { deriveOrgReadiness, OrgReadinessState } from '@/shared/org-readiness-v2';
import { ORG_READINESS_INSUFFICIENT } from '@/shared/errors/org-readiness.error';

describe('Org readiness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { token: string; login: { login: string; password: string } };
  let teacher: { token: string; login: { login: string; password: string }; membership: { id: string } };
  let student: { token: string; membership: { id: string } };
  let org: { id: string } | undefined;
  let academicYearId: string | undefined;
  let classSectionId: string | null = null; // set when we make org READY
  let testId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `org_ready_${Date.now()}`,
      with: { teacher: true, student: true },
    });

    org = { id: ctx.organization.id };
    director = {
      token: ctx.owner.accessToken,
      login: ctx.owner.login,
    };
    teacher = {
      token: ctx.teacher!.accessToken,
      login: ctx.teacher!.login,
      membership: ctx.teacher!.membership,
    };
    student = {
      token: ctx.student!.accessToken,
      membership: ctx.student!.membership,
    };

    // Academic year only – no class section → NOT_READY
    const year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: `E2E readiness ${Date.now()}`,
        startsAt: new Date('2024-09-01'),
        endsAt: new Date('2025-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    academicYearId = year.id;

    const readiness = await getOrgReadiness(prisma, org.id);
    expect(readiness).toBe('NOT_READY');
  });

  afterAll(async () => {
    if (testId) {
      await prisma.question.deleteMany({ where: { testId } }).catch(() => {});
      await prisma.test.delete({ where: { id: testId } }).catch(() => {});
    }
    if (classSectionId) {
      await prisma.classSection.delete({ where: { id: classSectionId } }).catch(() => {});
    }
    if (academicYearId) {
      await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
    }
    if (org?.id) {
      await prisma.membership.deleteMany({ where: { organizationId: org.id } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: org.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('ORG NOT_READY', () => {
    it('POST /tests → 201 (authoring allowed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          title: 'Draft test',
          organizationId: org.id,
          status: $Enums.PublishStatus.DRAFT,
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      testId = res.body.id;
    });

    it('POST /tests/:id/questions → 201 (authoring allowed)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/tests/${testId}/questions`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          text: 'Is 1 < 2?',
          type: $Enums.QuestionType.TRUE_FALSE,
          correctAnswer: 'true',
          order: 1,
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
    });

    it('PATCH /tests/:id → 200 (authoring allowed)', async () => {
      await request(app.getHttpServer())
        .patch(`/tests/${testId}`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({ title: 'Updated title' })
        .expect(200);
    });

    it('POST /assignments → 412 with standard error contract (code, requiredMinState, missing)', async () => {
      const derived = await deriveOrgReadiness(prisma, org!.id);
      expect(derived.canExecute).toBe(false);

      const res = await request(app.getHttpServer())
        .post('/assignments')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          organizationId: org.id,
          academicYearId,
          testId,
          targetType: 'STUDENTS',
          studentIds: [student.membership.id],
          openAt: new Date(Date.now() + 5_000).toISOString(),
          closeAt: new Date(Date.now() + 3_600_000).toISOString(),
          maxAttempts: 2,
          timeLimitSec: 900,
          shuffle: false,
          showExplain: 'ON_REVIEW',
          createdById: teacher.membership.id,
        });

      expect(res.status).toBe(412);
      expect(res.body?.code).toBe(ORG_READINESS_INSUFFICIENT);
      expect(res.body?.requiredMinState).toBe(OrgReadinessState.R2_STRUCTURE_READY);
      expect(Array.isArray(res.body?.missing)).toBe(true);
      expect(res.body?.state).toBe(derived.state);
      expect(res.body?.missing).toEqual(expect.arrayContaining(derived.missing));
    });

    it('GET /students → 412 (execution blocked) with same contract', async () => {
      const derived = await deriveOrgReadiness(prisma, org!.id);
      const res = await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${director.token}`)
        .query({ organizationId: org.id });

      expect(res.status).toBe(412);
      expect(res.body?.code).toBe(ORG_READINESS_INSUFFICIENT);
      expect(res.body?.requiredMinState).toBe(OrgReadinessState.R2_STRUCTURE_READY);
      expect(Array.isArray(res.body?.missing)).toBe(true);
      expect(res.body?.missing).toEqual(expect.arrayContaining(derived.missing));
    });

    it('POST /submissions → 412 with same contract', async () => {
      const derived = await deriveOrgReadiness(prisma, org!.id);
      const res = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ assignmentId: '00000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(412);
      expect(res.body?.code).toBe(ORG_READINESS_INSUFFICIENT);
      expect(res.body?.requiredMinState).toBe(OrgReadinessState.R2_STRUCTURE_READY);
      expect(res.body?.missing).toEqual(expect.arrayContaining(derived.missing));
    });
  });

  describe('ORG READY (after adding class section)', () => {
    beforeAll(async () => {
      const section = await prisma.classSection.create({
        data: {
          orgId: org.id,
          yearId: academicYearId,
          grade: $Enums.SchoolGrade.GRADE_7,
          section: 'A',
        },
        select: { id: true },
      });
      classSectionId = section.id;

      const readiness = await getOrgReadiness(prisma, org.id);
      expect(readiness).toBe('READY');
    });

    it('POST /tests still works (authoring)', async () => {
      const res = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          title: 'Another draft',
          organizationId: org.id,
          status: $Enums.PublishStatus.DRAFT,
        })
        .expect(201);
      await prisma.test.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('POST /assignments → 201 (execution allowed)', async () => {
      // Publish test first (org is READY now)
      await prisma.test.update({
        where: { id: testId },
        data: { status: $Enums.PublishStatus.PUBLISHED },
      });

      const res = await request(app.getHttpServer())
        .post('/assignments')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          organizationId: org.id,
          academicYearId,
          testId,
          targetType: 'STUDENTS',
          studentIds: [student.membership.id],
          openAt: new Date(Date.now() - 1000).toISOString(),
          closeAt: new Date(Date.now() + 3_600_000).toISOString(),
          maxAttempts: 2,
          timeLimitSec: 900,
          shuffle: false,
          showExplain: 'ON_REVIEW',
          createdById: teacher.membership.id,
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      await prisma.assignment.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('GET /students → 200 (execution allowed)', async () => {
      const res = await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${director.token}`)
        .query({ organizationId: org.id, page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
