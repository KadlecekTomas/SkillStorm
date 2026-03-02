import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { QuestionType } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { seedTenantScope, type TenantScopeSeedResult } from 'test/seed/seed-tenant-scope';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

function expectForbiddenOrNotFound(status: number) {
  expect([403, 404]).toContain(status);
}

describe('Tenant Scope Fortress (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: TenantScopeSeedResult;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
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
    seed = await seedTenantScope(app, prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('Teacher flow: create + add question + update works, delete denied without DELETE_TEST', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .send({
        title: 'Teacher RBAC Test',
        description: 'teacher flow',
        organizationId: seed.orgA.id,
      })
      .expect(201);

    const created = unwrap(createRes);
    const testId = created.id as string;
    expect(testId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .send({
        text: 'Teacher question',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tests/${testId}`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .send({ title: 'Teacher RBAC Test Updated' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/tests/${testId}`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .expect(403);
  });

  it('Director flow: create + add question + delete works', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${seed.orgA.director.token}`)
      .send({
        title: 'Director RBAC Test',
        description: 'director flow',
        organizationId: seed.orgA.id,
      })
      .expect(201);

    const created = unwrap(createRes);
    const testId = created.id as string;

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${seed.orgA.director.token}`)
      .send({
        text: 'Director question',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'false',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/tests/${testId}`)
      .set('Authorization', `Bearer ${seed.orgA.director.token}`)
      .expect(200);
  });

  it('Student flow: cannot create/edit tests or add questions', async () => {
    await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${seed.orgA.student.token}`)
      .send({
        title: 'Student forbidden test',
        organizationId: seed.orgA.id,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/tests/${seed.orgA.testId}/questions`)
      .set('Authorization', `Bearer ${seed.orgA.student.token}`)
      .send({
        text: 'Student forbidden question',
        type: QuestionType.TRUE_FALSE,
        score: 1,
        correctAnswer: 'true',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/tests/${seed.orgA.testId}`)
      .set('Authorization', `Bearer ${seed.orgA.student.token}`)
      .send({ title: 'Student cannot patch' })
      .expect(403);
  });

  it('Cross-org id guessing: TeacherA cannot read testB', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${seed.orgB.testId}`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`);

    expectForbiddenOrNotFound(res.status);
  });

  it('Cross-org create spoof: organizationId from body cannot target foreign org', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .send({
        title: 'Spoof org body',
        organizationId: seed.orgB.id,
      });

    expect(res.status).toBe(403);
  });

  it('Assignments/submissions are tenant isolated for student', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${seed.orgA.student.token}`)
      .expect(200);

    const assignments = unwrap(listRes) as Array<{ id: string }>;
    expect(assignments.some((a) => a.id === seed.orgB.assignmentId)).toBe(false);

    const subRes = await request(app.getHttpServer())
      .get(`/submissions/${seed.orgB.submissionId}`)
      .set('Authorization', `Bearer ${seed.orgA.student.token}`);

    expectForbiddenOrNotFound(subRes.status);
  });

  it('Year spoofing is blocked on analytics endpoints', async () => {
    await request(app.getHttpServer())
      .get('/analytics/student/errors')
      .query({ yearId: seed.orgB.activeAcademicYearId })
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .expect(400);
  });

  it('Cross-org analytics/classroom endpoints do not leak foreign org data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${seed.orgB.classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`);

    expectForbiddenOrNotFound(res.status);
  });

  it('Soft-delete scenario: adding question to deleted test returns 404', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${seed.orgA.director.token}`)
      .send({
        title: 'Soft delete test',
        description: 'soft-delete',
        organizationId: seed.orgA.id,
      })
      .expect(201);

    const testId = (unwrap(createRes) as { id: string }).id;
    await request(app.getHttpServer())
      .delete(`/tests/${testId}`)
      .set('Authorization', `Bearer ${seed.orgA.director.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${seed.orgA.teacher.token}`)
      .send({
        text: 'Should fail on deleted test',
        type: QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
      })
      .expect(404);
  });
});
