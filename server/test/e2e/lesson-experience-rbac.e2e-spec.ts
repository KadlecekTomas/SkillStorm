import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

describe('Lesson Experience D2-B HTTP governance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let foreignTeacherToken: string;
  let studentToken: string;
  let managerToken: string;
  let superadminToken: string;
  let localLessonId = '';
  let globalLessonId = '';

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
      seed: `lesson_http_${Date.now()}`,
      with: { student: true, superadmin: true },
    });
    const foreign = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `lesson_http_foreign_${Date.now()}`,
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
    const ids = [localLessonId, globalLessonId].filter(Boolean);
    if (ids.length > 0) {
      await prisma
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
          await tx.lessonExperienceCurriculumMapping.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: { in: ids } } },
          });
          await tx.lessonStage.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: { in: ids } } },
          });
          await tx.lessonExperienceVersion.deleteMany({
            where: { lessonExperienceId: { in: ids } },
          });
          await tx.lessonExperience.deleteMany({ where: { id: { in: ids } } });
        })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lets a teacher create a local Lesson Experience shell', async () => {
    const response = await api()
      .post('/lesson-experiences')
      .set('Authorization', auth(teacherToken))
      .send({
        slug: `teacher-lesson-${Date.now()}`,
        title: 'Teacher local lesson',
      })
      .expect(201);

    localLessonId = response.body?.id ?? response.body?.data?.id;
    expect(localLessonId).toEqual(expect.any(String));
  });

  it('conceals a local lesson from another tenant', async () => {
    await api()
      .get(`/lesson-experiences/${localLessonId}`)
      .set('Authorization', auth(foreignTeacherToken))
      .expect(404);
  });

  it('keeps Lesson Experience authoring hidden from students', async () => {
    await api()
      .get('/lesson-experiences')
      .set('Authorization', auth(studentToken))
      .expect(403);

    await api()
      .post('/lesson-experiences')
      .set('Authorization', auth(studentToken))
      .send({ slug: 'student-lesson-forbidden', title: 'Forbidden' })
      .expect(403);
  });

  it('does not let teachers use leadership publication routes', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    await api()
      .post(`/lesson-experiences/versions/${missing}/publish`)
      .set('Authorization', auth(teacherToken))
      .expect(403);

    await api()
      .post(`/lesson-experiences/versions/${missing}/publish`)
      .set('Authorization', auth(managerToken))
      .expect(404);
  });

  it('keeps global lesson mutation and draft reads platform-only', async () => {
    await api()
      .post('/platform/lesson-experiences')
      .set('Authorization', auth(teacherToken))
      .send({ slug: 'teacher-global-lesson-forbidden', title: 'Forbidden global lesson' })
      .expect(403);

    const response = await api()
      .post('/platform/lesson-experiences')
      .set('Authorization', auth(superadminToken))
      .send({
        slug: `global-lesson-${Date.now()}`,
        title: 'Global Lesson draft fixture',
      })
      .expect(201);

    globalLessonId = response.body?.id ?? response.body?.data?.id;
    expect(globalLessonId).toEqual(expect.any(String));

    await api()
      .get(`/lesson-experiences/${globalLessonId}`)
      .set('Authorization', auth(teacherToken))
      .expect(404);

    const platformView = await api()
      .get(`/platform/lesson-experiences/${globalLessonId}`)
      .set('Authorization', auth(superadminToken))
      .expect(200);

    const payload = platformView.body?.data ?? platformView.body;
    expect(payload?.id).toBe(globalLessonId);
  });
});
