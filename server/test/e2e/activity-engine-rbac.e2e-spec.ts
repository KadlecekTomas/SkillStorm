import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

describe('Activity D2-A HTTP governance boundaries (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let foreignTeacherToken: string;
  let studentToken: string;
  let managerToken: string;
  let superadminToken: string;
  let localActivityId = '';
  let globalActivityId = '';

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `activity_http_${Date.now()}`,
      with: { student: true, superadmin: true },
    });
    const foreign = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `activity_http_foreign_${Date.now()}`,
    });

    await prisma.organization.updateMany({
      where: { id: { in: [ctx.organization.id, foreign.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    teacherToken = ctx.actor.accessToken;
    foreignTeacherToken = foreign.actor.accessToken;
    studentToken = ctx.student!.accessToken;
    managerToken = ctx.owner.accessToken;
    superadminToken = ctx.superadmin!.accessToken;
  });

  afterAll(async () => {
    if (localActivityId || globalActivityId) {
      await prisma
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
          const ids = [localActivityId, globalActivityId].filter(Boolean);
          await tx.activityCurriculumMapping.deleteMany({
            where: { activityVersion: { activityId: { in: ids } } },
          });
          await tx.activityVersion.deleteMany({ where: { activityId: { in: ids } } });
          await tx.activity.deleteMany({ where: { id: { in: ids } } });
        })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lets a teacher discover engines and create a local draft Activity', async () => {
    await api()
      .get('/activities/engines')
      .set('Authorization', auth(teacherToken))
      .expect(200);

    const response = await api()
      .post('/activities')
      .set('Authorization', auth(teacherToken))
      .send({
        slug: `teacher-local-${Date.now()}`,
        title: 'Teacher local Activity',
      })
      .expect(201);

    localActivityId = response.body?.id ?? response.body?.data?.id;
    expect(localActivityId).toEqual(expect.any(String));
  });

  it('conceals organization-local Activity from another tenant', async () => {
    await api()
      .get(`/activities/${localActivityId}`)
      .set('Authorization', auth(foreignTeacherToken))
      .expect(404);
  });

  it('keeps Activity authoring hidden from students', async () => {
    await api()
      .get('/activities')
      .set('Authorization', auth(studentToken))
      .expect(403);

    await api()
      .post('/activities')
      .set('Authorization', auth(studentToken))
      .send({ slug: 'student-forbidden', title: 'Forbidden' })
      .expect(403);
  });

  it('does not let teachers use leadership publication routes', async () => {
    await api()
      .post('/activities/versions/00000000-0000-4000-8000-000000000000/publish')
      .set('Authorization', auth(teacherToken))
      .expect(403);

    await api()
      .post('/activities/versions/00000000-0000-4000-8000-000000000000/publish')
      .set('Authorization', auth(managerToken))
      .expect(404);
  });

  it('keeps global Activity mutation platform-only', async () => {
    await api()
      .post('/platform/activities')
      .set('Authorization', auth(teacherToken))
      .send({ slug: 'teacher-global-forbidden', title: 'Forbidden global' })
      .expect(403);

    const response = await api()
      .post('/platform/activities')
      .set('Authorization', auth(superadminToken))
      .send({
        slug: `global-http-${Date.now()}`,
        title: 'Global HTTP governance fixture',
      })
      .expect(201);

    globalActivityId = response.body?.id ?? response.body?.data?.id;
    expect(globalActivityId).toEqual(expect.any(String));
  });
});
