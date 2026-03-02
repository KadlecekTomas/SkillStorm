// test/e2e/subject-activation.e2e-spec.ts
/**
 * Subject activation / deactivation lifecycle (e2e)
 *
 * A — Deactivated subject blocks POST /tests → 400 SUBJECT_INACTIVE
 * B — Reactivated subject allows POST /tests → 201
 * C — GET /tests/:id succeeds after subject is deactivated (history preserved)
 * D — GET /subjects (default) hides inactive subject
 * E — GET /subjects?includeInactive=true shows inactive subject
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Subject activation lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let directorToken: string;
  let subjectId: string;
  let yearId: string;
  let userIds: string[];

  // Created in Test B, used in Test C
  let createdTestId: string;

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

    const ts = Date.now();
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `subact_${ts}`,
    });

    orgId = ctx.organization.id;
    directorToken = ctx.owner.accessToken;
    userIds = [ctx.owner.user.id];

    // Activate org so POST /tests and GET /subjects pass org-readiness
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) throw new Error('Missing current academic year for fixture org');
    yearId = year.id;

    // Create a subject directly — isActive defaults to true
    const subject = await prisma.subject.create({
      data: { organizationId: orgId, name: `Activation Test Subject ${ts}` },
      select: { id: true },
    });
    subjectId = subject.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.test.deleteMany({ where: { organizationId: orgId } });
      await prisma.subjectLevel.deleteMany({ where: { subject: { organizationId: orgId } } });
      await prisma.subject.deleteMany({ where: { organizationId: orgId } });
      await prisma.academicYear.deleteMany({ where: { orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (userIds?.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── Test A ────────────────────────────────────────────────────────────────

  it('A — deactivate subject, then POST /tests → 400 SUBJECT_INACTIVE', async () => {
    // Deactivate
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectId}/activation`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ isActive: false })
      .expect(200);

    // Verify DB
    const row = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { isActive: true },
    });
    expect(row?.isActive).toBe(false);

    // Create test attempt → must be rejected
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Should fail', subjectId, academicYearId: yearId })
      .expect(400);

    expect(res.body.code ?? res.body.message).toMatch(/SUBJECT_INACTIVE/);
  });

  // ── Test B ────────────────────────────────────────────────────────────────

  it('B — reactivate subject, then POST /tests → 201', async () => {
    // Reactivate
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectId}/activation`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ isActive: true })
      .expect(200);

    const row = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { isActive: true },
    });
    expect(row?.isActive).toBe(true);

    // Now create a test — must succeed
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Active subject test', subjectId, academicYearId: yearId })
      .expect(201);

    const body = unwrap(res);
    expect(body.id).toBeTruthy();
    createdTestId = body.id;
  });

  // ── Test C ────────────────────────────────────────────────────────────────

  it('C — deactivate subject after test creation, GET /tests/:id still returns 200', async () => {
    expect(createdTestId).toBeTruthy();

    // Deactivate again
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectId}/activation`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ isActive: false })
      .expect(200);

    // Historical test must still be readable
    const res = await request(app.getHttpServer())
      .get(`/tests/${createdTestId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    const body = unwrap(res);
    expect(body.id).toBe(createdTestId);
  });

  // ── Test D ────────────────────────────────────────────────────────────────

  it('D — GET /subjects (default) hides inactive subject', async () => {
    // Subject is currently inactive from Test C

    const res = await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    const body = unwrap(res);
    const items: any[] = body?.data ?? body ?? [];
    const found = items.find((s: any) => s.id === subjectId);
    expect(found).toBeUndefined();
  });

  // ── Test E ────────────────────────────────────────────────────────────────

  it('E — GET /subjects?includeInactive=true returns inactive subject', async () => {
    const res = await request(app.getHttpServer())
      .get('/subjects?includeInactive=true')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    const body = unwrap(res);
    const items: any[] = body?.data ?? body ?? [];
    const found = items.find((s: any) => s.id === subjectId);
    expect(found).toBeDefined();
    expect(found.isActive).toBe(false);
  });
});
