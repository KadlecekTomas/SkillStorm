import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

describe('Curriculum D1 HTTP governance boundaries (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let studentToken: string;
  let managerToken: string;
  let superadminToken: string;

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `curriculum_http_${Date.now()}`,
      with: { student: true, superadmin: true },
    });

    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });

    teacherToken = ctx.actor.accessToken;
    studentToken = ctx.student!.accessToken;
    managerToken = ctx.owner.accessToken;
    superadminToken = ctx.superadmin!.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('lets a teacher read school curriculum but not mutate its governance', async () => {
    await api()
      .get('/curriculum/profiles')
      .set('Authorization', auth(teacherToken))
      .expect(200);

    await api()
      .post('/curriculum/profiles')
      .set('Authorization', auth(teacherToken))
      .send({ title: 'Teacher must not create this profile' })
      .expect(403);
  });

  it('allows school leadership to create the tenant curriculum profile', async () => {
    const response = await api()
      .post('/curriculum/profiles')
      .set('Authorization', auth(managerToken))
      .send({ title: 'ŠVP governance HTTP E2E' })
      .expect(201);

    expect(response.body?.id ?? response.body?.data?.id).toEqual(expect.any(String));
  });

  it('keeps school curriculum governance hidden from students', async () => {
    await api()
      .get('/curriculum/profiles')
      .set('Authorization', auth(studentToken))
      .expect(403);
  });

  it('keeps canonical framework governance platform-only', async () => {
    await api()
      .get('/platform/curriculum/frameworks')
      .set('Authorization', auth(teacherToken))
      .expect(403);

    await api()
      .post('/platform/curriculum/frameworks')
      .set('Authorization', auth(teacherToken))
      .send({
        code: 'SHOULD-NOT-EXIST',
        jurisdiction: 'CZ',
        educationType: 'ZV',
        title: 'Forbidden framework',
        authorityName: 'Forbidden actor',
      })
      .expect(403);

    await api()
      .get('/platform/curriculum/frameworks')
      .set('Authorization', auth(superadminToken))
      .expect(200);
  });
});
