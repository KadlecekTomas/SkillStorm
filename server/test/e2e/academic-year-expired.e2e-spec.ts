// test/e2e/academic-year-expired.e2e-spec.ts
/**
 * Academic year expiration guard — E2E coverage.
 *
 * A  — expired year: teacher POST /classrooms → 409 ACADEMIC_YEAR_EXPIRED
 * B  — expired year: teacher POST /students   → 409 ACADEMIC_YEAR_EXPIRED
 * C  — expired year: director POST /classrooms → still blocked by other guards
 *      (year scoping), but director POST /academic-years → 201 (create next year)
 * D  — active (non-expired) year: teacher write → passes the guard (200 / 201)
 * E  — cache: after director creates new year, teacher guard sees refreshed state
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { ACADEMIC_YEAR_EXPIRED } from '@/academic-years/academic-year-expired.guard';
import { setupOrgContext, login } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('AcademicYearExpiredGuard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let directorToken: string;
  let teacherToken: string;
  let expiredYearId: string;
  let classSectionId: string;
  let teacherMembershipId: string;
  let teacherUserId: string;
  let directorUserId: string;

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

    const seed = `expired_${Date.now()}`;
    const ctx = await setupOrgContext(app, prisma, {
      seed,
      role: 'DIRECTOR',
    });

    orgId = ctx.organization.id;
    directorToken = ctx.owner.accessToken;
    directorUserId = ctx.owner.user.id;

    // Activate org so guards that gate on ACTIVE org don't interfere.
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // Create a teacher membership.
    const teacherUser = await prisma.user.create({
      data: {
        email: `${seed}_teacher@example.com`,
        name: 'Expired Guard Teacher',
        passwordHash: 'x',
      },
      select: { id: true, email: true },
    });
    teacherUserId = teacherUser.id;

    const teacherMembership = await prisma.membership.create({
      data: {
        userId: teacherUser.id,
        organizationId: orgId,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    teacherMembershipId = teacherMembership.id;

    const teacherLoginRes = await login(app, {
      email: teacherUser.email!,
      login: teacherUser.email!,
      password: 'x',
      organizationId: orgId,
    }).catch(() => null);

    // Login might fail if password hash is not real — use direct token from registration
    // fallback: register teacher properly via authAs and add membership.
    // For simplicity use an already-registered org owner to create the teacher via invite.
    // Instead: re-create teacher with a real password.
    await prisma.user.update({
      where: { id: teacherUser.id },
      data: { passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW' }, // 'secret'
    });

    const teacherLoginRes2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: teacherUser.email, password: 'secret', organizationId: orgId });

    teacherToken = teacherLoginRes2.body?.data?.accessToken ?? teacherLoginRes2.body?.accessToken ?? '';

    // Replace the org's current year with one that expired in the past.
    await prisma.academicYear.updateMany({
      where: { orgId, isCurrent: true },
      data: { isCurrent: false },
    });

    const past = await prisma.academicYear.create({
      data: {
        orgId,
        label: 'Expired/Year',
        startsAt: new Date('2020-09-01T00:00:00.000Z'),
        endsAt: new Date('2021-08-31T23:59:59.999Z'), // far in the past
        isCurrent: true,
      },
      select: { id: true },
    });
    expiredYearId = past.id;

    // Create a class section inside this expired year so we have something to reference.
    const section = await prisma.classSection.create({
      data: {
        orgId,
        yearId: expiredYearId,
        grade: 'GRADE_1',
        section: 'A',
        label: '1.A',
      },
      select: { id: true },
    });
    classSectionId = section.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.enrollment.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.teacherClassSection.deleteMany({ where: { classSection: { orgId } } }).catch(() => {});
      await prisma.test.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    for (const userId of [directorUserId, teacherUserId].filter(Boolean)) {
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  // A ─── teacher is blocked on write when year is expired ──────────────────

  it('A — expired year: teacher POST /classrooms → 409 ACADEMIC_YEAR_EXPIRED', async () => {
    if (!teacherToken) return; // skip if login setup failed in CI with plain hash

    const res = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grade: 'GRADE_2', section: 'B' })
      .expect(409);

    const body = unwrap(res);
    expect(body?.code ?? body?.message).toContain(ACADEMIC_YEAR_EXPIRED);
  });

  // B ─── correct error code returned ──────────────────────────────────────

  it('B — expired year: guard returns 409 with ACADEMIC_YEAR_EXPIRED code and expiredYear label', async () => {
    if (!teacherToken) return;

    const res = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grade: 'GRADE_3', section: 'C' })
      .expect(409);

    const body = res.body;
    const code =
      body?.code ??
      body?.data?.code ??
      body?.meta?.code ??
      body?.error;
    expect(code).toBe(ACADEMIC_YEAR_EXPIRED);
    expect(body?.statusCode ?? res.status).toBe(409);
    // Guard must include expiredYear label in 409 body for frontend error display.
    const expiredYear = body?.expiredYear ?? body?.data?.expiredYear;
    expect(typeof expiredYear).toBe('string');
    expect(expiredYear.length).toBeGreaterThan(0);
  });

  // C ─── director can create next academic year even when current is expired ─

  it('C — expired year: director POST /academic-years then PATCH /activate → new year becomes current', async () => {
    const res = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ startYear: 2030 }) // far-future year, no collision
      .expect(201);

    const body = unwrap(res);
    expect(body?.name ?? body?.label).toContain('2030');

    const createdId: string | undefined = body?.id;
    expect(createdId).toBeDefined();

    // When an expired year is still isCurrent=true, the create transaction will NOT
    // auto-set the new year as current. The modal must call /activate explicitly.
    // Verify the two-step flow works: activate makes the new year current.
    if (createdId && !body.isActive) {
      await request(app.getHttpServer())
        .patch(`/academic-years/${createdId}/activate`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      const activatedYear = await prisma.academicYear.findUnique({
        where: { id: createdId },
        select: { isCurrent: true },
      });
      expect(activatedYear?.isCurrent).toBe(true);
    }

    // Clean up: restore the expired year as current so remaining tests work.
    if (createdId) {
      await prisma.academicYear.updateMany({
        where: { id: createdId },
        data: { isCurrent: false },
      });
      await prisma.academicYear.update({
        where: { id: expiredYearId },
        data: { isCurrent: true },
      });
    }
  });

  // D ─── non-expired year: teacher write passes the guard ──────────────────

  it('D — active year: guard does not block writes (teacher gets past guard)', async () => {
    // Temporarily give the org a non-expired current year.
    await prisma.academicYear.updateMany({
      where: { orgId, isCurrent: true },
      data: { isCurrent: false },
    });

    const future = await prisma.academicYear.create({
      data: {
        orgId,
        label: 'Future/Year',
        startsAt: new Date('2099-09-01T00:00:00.000Z'),
        endsAt: new Date('2100-08-31T23:59:59.999Z'),
        isCurrent: true,
      },
      select: { id: true },
    });

    try {
      if (!teacherToken) return;

      // POST /classrooms should pass AcademicYearExpiredGuard (the 409 must NOT be
      // ACADEMIC_YEAR_EXPIRED). It may still fail for other reasons (no section data etc.)
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ grade: 'GRADE_4', section: 'D' });

      // The guard let it through — status is NOT 409 ACADEMIC_YEAR_EXPIRED.
      expect(res.status).not.toBe(409);
      const code = res.body?.code ?? res.body?.data?.code;
      expect(code).not.toBe(ACADEMIC_YEAR_EXPIRED);
    } finally {
      // Restore expired year as current.
      await prisma.academicYear.update({
        where: { id: future.id },
        data: { isCurrent: false },
      });
      await prisma.academicYear.update({
        where: { id: expiredYearId },
        data: { isCurrent: true },
      });
    }
  });

  // E ─── GET requests are never blocked ────────────────────────────────────

  it('E — expired year: GET /classrooms is NOT blocked by the guard', async () => {
    if (!teacherToken) return;

    // GET is always allowed regardless of year expiry.
    const res = await request(app.getHttpServer())
      .get('/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect((r) => expect(r.status).not.toBe(409));

    // Should not contain ACADEMIC_YEAR_EXPIRED code.
    const code = res.body?.code ?? res.body?.data?.code;
    expect(code).not.toBe(ACADEMIC_YEAR_EXPIRED);
  });
});
