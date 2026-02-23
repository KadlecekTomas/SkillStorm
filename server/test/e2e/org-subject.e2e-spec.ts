// test/e2e/org-subject.e2e-spec.ts
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { createSystemUser, setupOrgContext } from 'test/helpers';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('OrgSubject (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let superAdmin: { token: string };
  let directorA: { token: string; organization: { id: string } };
  let directorB: { token: string; organization: { id: string } };
  let teacherA: { token: string; organization: { id: string } };
  let orgAId: string;
  let orgBId: string;

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

    const superUser = await createSystemUser(app, prisma, 'SUPERADMIN', 'orgsub_super');
    superAdmin = { token: superUser.accessToken };

    const ctxA = await setupOrgContext(app, prisma, { role: 'DIRECTOR', seed: 'orgsubA' });
    const ctxB = await setupOrgContext(app, prisma, { role: 'DIRECTOR', seed: 'orgsubB' });

    directorA = { token: ctxA.owner.accessToken, organization: ctxA.organization };
    directorB = { token: ctxB.owner.accessToken, organization: ctxB.organization };
    orgAId = ctxA.organization.id;
    orgBId = ctxB.organization.id;

    const teacherCtx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: 'orgsubA_teacher',
      with: { director: true },
    });
    teacherA = { token: teacherCtx.actor.accessToken, organization: teacherCtx.organization };

    // Tests and classrooms require current academic year
    for (const orgId of [orgAId, orgBId]) {
      const existing = await prisma.academicYear.findFirst({
        where: { orgId, isCurrent: true },
      });
      if (!existing) {
        await prisma.academicYear.create({
          data: {
            orgId,
            label: '2024/25',
            startsAt: new Date('2024-09-01'),
            endsAt: new Date('2025-06-30'),
            isCurrent: true,
          },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('1) Director can create subject', () => {
    it('POST /org-subjects → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/org-subjects')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          name: 'Matematika',
          gradeFrom: 1,
          gradeTo: 9,
          organizationId: orgAId,
        });
      expect(res.status).toBe(201);
      const body = unwrapBody(res);
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Matematika');
      expect(body.gradeFrom).toBe(1);
      expect(body.gradeTo).toBe(9);
      expect(body.organizationId).toBe(orgAId);
    });
  });

  describe('2) Teacher cannot create subject', () => {
    it('POST /org-subjects → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/org-subjects')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          name: 'Čeština',
          gradeFrom: 1,
          gradeTo: 5,
          organizationId: orgAId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('3) Subject list filtered by organization', () => {
    it('GET /org-subjects returns only own org subjects', async () => {
      const res = await request(app.getHttpServer())
        .get('/org-subjects')
        .set('Authorization', `Bearer ${directorA.token}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      const list = Array.isArray(body) ? body : body?.items ?? [];
      expect(list.length).toBeGreaterThanOrEqual(1);
      list.forEach((s: { organizationId: string }) => {
        expect(s.organizationId).toBe(orgAId);
      });
    });
  });

  describe('4) Subject list filtered by grade', () => {
    it('GET /org-subjects?grade=3 returns subjects valid for grade 3', async () => {
      const res = await request(app.getHttpServer())
        .get('/org-subjects?grade=3')
        .set('Authorization', `Bearer ${directorA.token}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      const list = Array.isArray(body) ? body : body?.items ?? [];
      list.forEach((s: { gradeFrom: number; gradeTo: number }) => {
        expect(s.gradeFrom).toBeLessThanOrEqual(3);
        expect(s.gradeTo).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('5) Cannot assign subject from different org to test', () => {
    it('PATCH /tests/:id with subjectId from other org → 400', async () => {
      const subjectB = await prisma.orgSubject.create({
        data: { name: 'Cizí', gradeFrom: 1, gradeTo: 9, organizationId: orgBId },
      });
      const membershipA = await prisma.membership.findFirst({
        where: { organizationId: orgAId, deletedAt: null },
        select: { id: true },
      });
      const testA = await prisma.test.create({
        data: {
          title: 'Test A',
          organizationId: orgAId,
          creatorId: membershipA!.id,
          status: 'DRAFT',
        },
      });
      const res = await request(app.getHttpServer())
        .patch(`/tests/${testA.id}`)
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({ subjectId: subjectB.id });
      expect(res.status).toBe(400);
      await prisma.test.delete({ where: { id: testA.id } }).catch(() => {});
      await prisma.orgSubject.delete({ where: { id: subjectB.id } }).catch(() => {});
    });
  });

  describe('6) Test GET returns subject object', () => {
    it('GET /tests/:id includes subject when set', async () => {
      const subjectA = await prisma.orgSubject.findFirst({
        where: { organizationId: orgAId },
      });
      if (!subjectA) return;
      const membershipA = await prisma.membership.findFirst({
        where: { organizationId: orgAId, deletedAt: null },
        select: { id: true },
      });
      const testA = await prisma.test.create({
        data: {
          title: 'Test s předmětem',
          organizationId: orgAId,
          creatorId: membershipA!.id,
          orgSubjectId: subjectA.id,
          status: 'DRAFT',
        },
      });
      const res = await request(app.getHttpServer())
        .get(`/tests/${testA.id}`)
        .set('Authorization', `Bearer ${directorA.token}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      expect(body.subject).toBeDefined();
      expect(body.subject.id).toBe(subjectA.id);
      expect(body.subject.name).toBe(subjectA.name);
      expect(body.subject.gradeFrom).toBe(subjectA.gradeFrom);
      expect(body.subject.gradeTo).toBe(subjectA.gradeTo);
      await prisma.test.delete({ where: { id: testA.id } }).catch(() => {});
    });
  });

  describe('8) Risk overview works with subjectId filter', () => {
    it('GET /classrooms/:id/risk-overview?subjectId=... does not error', async () => {
      const subjectA = await prisma.orgSubject.findFirst({
        where: { organizationId: orgAId },
      });
      const classSection = await prisma.classSection.findFirst({
        where: { orgId: orgAId },
        select: { id: true },
      });
      if (!classSection || !subjectA) return;
      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSection.id}/risk-overview?subjectId=${subjectA.id}`)
        .set('Authorization', `Bearer ${directorA.token}`);
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('9) Assign test to class – subject grade-range mismatch', () => {
    it('POST /tests/:id/assign with subject (1–2) to class grade 6 → 400 SUBJECT_GRADE_MISMATCH', async () => {
      const yearA = await prisma.academicYear.findFirst({
        where: { orgId: orgAId, isCurrent: true },
        select: { id: true },
      });
      if (!yearA) return;

      const subject12 = await prisma.orgSubject.create({
        data: { name: 'Pro ročník 1-2', gradeFrom: 1, gradeTo: 2, organizationId: orgAId },
      });
      const classGrade6 = await prisma.classSection.create({
        data: {
          orgId: orgAId,
          yearId: yearA.id,
          grade: 'GRADE_6',
          section: 'A',
        },
      });
      const membershipA = await prisma.membership.findFirst({
        where: { organizationId: orgAId, deletedAt: null },
        select: { id: true },
      });
      if (!membershipA) return;
      const testWithSubject = await prisma.test.create({
        data: {
          title: 'Test pro 1.-2. ročník',
          organizationId: orgAId,
          creatorId: membershipA.id,
          orgSubjectId: subject12.id,
          status: 'PUBLISHED',
        },
      });
      await prisma.question.create({
        data: {
          testId: testWithSubject.id,
          text: 'Ano nebo ne?',
          type: 'TRUE_FALSE',
          correctAnswer: 'true',
          score: 1,
          order: 0,
        },
      });

      const openAt = new Date();
      const closeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const res = await request(app.getHttpServer())
        .post(`/tests/${testWithSubject.id}/assign`)
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          classSectionId: classGrade6.id,
          openAt: openAt.toISOString(),
          closeAt: closeAt.toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        });

      expect(res.status).toBe(400);
      const body = res.body?.message ?? res.body;
      const code = typeof body === 'object' ? body?.code : undefined;
      const message = typeof body === 'object' ? body?.message : body;
      expect(code).toBe('SUBJECT_GRADE_MISMATCH');
      expect(message).toContain('předmět není určen pro daný ročník');

      await prisma.test.delete({ where: { id: testWithSubject.id } }).catch(() => {});
      await prisma.classSection.delete({ where: { id: classGrade6.id } }).catch(() => {});
      await prisma.orgSubject.delete({ where: { id: subject12.id } }).catch(() => {});
    });

    it('POST /tests/:id/assign with subject (1–9) to class grade 5 → 201 (valid)', async () => {
      const yearA = await prisma.academicYear.findFirst({
        where: { orgId: orgAId, isCurrent: true },
        select: { id: true },
      });
      if (!yearA) return;

      const subject19 = await prisma.orgSubject.create({
        data: { name: 'Pro 1-9', gradeFrom: 1, gradeTo: 9, organizationId: orgAId },
      });
      const classGrade5 = await prisma.classSection.create({
        data: {
          orgId: orgAId,
          yearId: yearA.id,
          grade: 'GRADE_5',
          section: 'B',
        },
      });
      const membershipA = await prisma.membership.findFirst({
        where: { organizationId: orgAId, deletedAt: null },
        select: { id: true },
      });
      if (!membershipA) return;
      const testWithSubject = await prisma.test.create({
        data: {
          title: 'Test pro 1.-9. ročník',
          organizationId: orgAId,
          creatorId: membershipA.id,
          orgSubjectId: subject19.id,
          status: 'PUBLISHED',
        },
      });
      await prisma.question.create({
        data: {
          testId: testWithSubject.id,
          text: 'Otázka?',
          type: 'TRUE_FALSE',
          correctAnswer: 'true',
          score: 1,
          order: 0,
        },
      });

      const openAt = new Date();
      const closeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const res = await request(app.getHttpServer())
        .post(`/tests/${testWithSubject.id}/assign`)
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          classSectionId: classGrade5.id,
          openAt: openAt.toISOString(),
          closeAt: closeAt.toISOString(),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        });

      expect(res.status).toBe(201);
      const body = unwrapBody(res);
      expect(body).toHaveProperty('id');
      expect(body.classSectionId).toBe(classGrade5.id);
      expect(body.testId).toBe(testWithSubject.id);

      await prisma.assignment.deleteMany({ where: { testId: testWithSubject.id } }).catch(() => {});
      await prisma.test.delete({ where: { id: testWithSubject.id } }).catch(() => {});
      await prisma.classSection.delete({ where: { id: classGrade5.id } }).catch(() => {});
      await prisma.orgSubject.delete({ where: { id: subject19.id } }).catch(() => {});
    });
  });
});
