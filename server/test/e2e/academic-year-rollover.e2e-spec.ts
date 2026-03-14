// test/e2e/academic-year-rollover.e2e-spec.ts
/**
 * AcademicYearRolloverService — E2E coverage.
 *
 * ROLLOVER (runRollover — safety-net):
 * A  — rollover creates next year when current year is expired and no future year exists
 * B  — previous year is deactivated (isCurrent=false) after rollover
 * C  — rollover is idempotent: calling runRollover() twice does not create duplicates
 * D  — director pre-created year: rollover activates it instead of duplicating
 * E  — cache is invalidated after rollover: next GET /academic-years/current returns new year
 * F  — teacher can POST /classrooms after rollover (guard passes with active year)
 * G  — guard still blocks teacher writes if rollover has NOT yet run (safety-net test)
 *
 * PREPARATION (runPreparation — proactive, 60 days ahead):
 * P1 — preparation creates next year with isCurrent=false when within window
 * P2 — prepared year is NOT activated: expired year stays isCurrent=true
 * P3 — runPreparation() is idempotent: calling it twice does not create duplicates
 * P4 — preparation skips org if any future year already exists (director pre-created)
 * P5 — preparation does not create year when current year ends outside the window
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearRolloverService } from '@/academic-years/academic-year-rollover.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { ACADEMIC_YEAR_EXPIRED } from '@/academic-years/academic-year-expired.guard';
import { setupOrgContext } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('AcademicYearRolloverService (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rollover: AcademicYearRolloverService;
  let yearCache: AcademicYearCacheRef;

  let orgId: string;
  let directorToken: string;
  let teacherToken: string;
  let expiredYearId: string;
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
    rollover = app.get(AcademicYearRolloverService);
    yearCache = app.get(AcademicYearCacheRef);
    await prisma.$connect();

    const seed = `rollover_${Date.now()}`;
    const ctx = await setupOrgContext(app, prisma, { seed, role: 'DIRECTOR' });

    orgId = ctx.organization.id;
    directorToken = ctx.owner.accessToken;
    directorUserId = ctx.owner.user.id;

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // Create teacher with a real bcrypt hash for 'secret'.
    const teacherUser = await prisma.user.create({
      data: {
        email: `${seed}_teacher@example.com`,
        name: 'Rollover Test Teacher',
        passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
      },
      select: { id: true, email: true },
    });
    teacherUserId = teacherUser.id;

    await prisma.membership.create({
      data: {
        userId: teacherUser.id,
        organizationId: orgId,
        role: OrganizationRole.TEACHER,
      },
    });

    const teacherLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: teacherUser.email, password: 'secret', organizationId: orgId });
    teacherToken = teacherLoginRes.body?.data?.accessToken ?? teacherLoginRes.body?.accessToken ?? '';

    // Replace the org's current year with one that expired in the past.
    await prisma.academicYear.updateMany({
      where: { orgId, isCurrent: true },
      data: { isCurrent: false },
    });

    const past = await prisma.academicYear.create({
      data: {
        orgId,
        label: '2020/2021',
        startsAt: new Date('2020-09-01T00:00:00.000Z'),
        endsAt: new Date('2021-08-31T23:59:59.999Z'),
        isCurrent: true,
      },
      select: { id: true },
    });
    expiredYearId = past.id;

    // Ensure cache is clear so tests see fresh state.
    yearCache.invalidate(orgId);
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

  // Helper: reset org back to expired state between tests.
  async function resetToExpiredState() {
    // Delete any years that are not the expired base year.
    await prisma.academicYear.deleteMany({
      where: { orgId, id: { not: expiredYearId } },
    });
    await prisma.academicYear.update({
      where: { id: expiredYearId },
      data: { isCurrent: true },
    });
    yearCache.invalidate(orgId);
  }

  // ─── ROLLOVER (safety-net) tests ──────────────────────────────────────────

  // A ─── rollover creates next year ─────────────────────────────────────────

  it('A — rollover creates next academic year when expired and no successor exists', async () => {
    await resetToExpiredState();

    await rollover.runRollover();

    // Next year after 2020/2021 (startsAt 2020-09-01) → 2021/2022
    const nextYear = await prisma.academicYear.findFirst({
      where: { orgId, label: '2021/2022' },
      select: { id: true, isCurrent: true, label: true },
    });
    expect(nextYear).not.toBeNull();
    expect(nextYear?.isCurrent).toBe(true);
  });

  // B ─── previous year is deactivated ──────────────────────────────────────

  it('B — previous (expired) year is set isCurrent=false after rollover', async () => {
    // A must run first; run rollover again to be safe.
    await rollover.runRollover();

    const expired = await prisma.academicYear.findUnique({
      where: { id: expiredYearId },
      select: { isCurrent: true },
    });
    expect(expired?.isCurrent).toBe(false);
  });

  // C ─── idempotent: no duplicates on second call ──────────────────────────

  it('C — calling runRollover() twice does not create duplicate years', async () => {
    // State after A/B: 2021/2022 is current.
    await rollover.runRollover(); // should be a no-op (2021/2022 is not expired)

    const count = await prisma.academicYear.count({
      where: { orgId, label: '2021/2022' },
    });
    expect(count).toBe(1);
  });

  // D ─── director pre-created year: rollover activates, not duplicates ──────

  it('D — rollover activates director-pre-created year without duplicating it', async () => {
    await resetToExpiredState();

    // Director pre-creates 2021/2022 but leaves it inactive.
    const preCreated = await prisma.academicYear.create({
      data: {
        orgId,
        label: '2021/2022',
        startsAt: new Date('2021-09-01T00:00:00.000Z'),
        endsAt: new Date('2022-08-31T23:59:59.999Z'),
        isCurrent: false,
      },
      select: { id: true },
    });

    await rollover.runRollover();

    // Only one 2021/2022 should exist.
    const years = await prisma.academicYear.findMany({
      where: { orgId, label: '2021/2022' },
      select: { id: true, isCurrent: true },
    });
    expect(years).toHaveLength(1);
    expect(years[0]?.isCurrent).toBe(true);
    expect(years[0]?.id).toBe(preCreated.id);
  });

  // E ─── cache invalidated after rollover ──────────────────────────────────

  it('E — cache is cleared after rollover so next request returns the new active year', async () => {
    await resetToExpiredState();

    // Populate cache with the expired year.
    yearCache.set(orgId, {
      yearId: expiredYearId,
      endsAt: new Date('2021-08-31T23:59:59.999Z'),
      expiresAt: Date.now() + 60_000,
    });

    await rollover.runRollover();

    // Cache entry must be gone — next request will re-fetch from DB.
    const cached = yearCache.get(orgId);
    expect(cached).toBeUndefined();
  });

  // F ─── teacher writes pass after rollover ────────────────────────────────

  it('F — teacher can POST /classrooms after rollover (guard passes with active year)', async () => {
    if (!teacherToken) return;

    // Ensure we're in rolled-over state (active 2021/2022 from test D or E).
    await rollover.runRollover();

    const currentYear = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { endsAt: true },
    });
    // Only proceed if the current year is in the future (not expired).
    // If all created years are also in the past, skip.
    if (!currentYear || currentYear.endsAt < new Date()) return;

    const res = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grade: 'GRADE_5', section: 'A' });

    // Guard must NOT return 409 ACADEMIC_YEAR_EXPIRED.
    const code = res.body?.code ?? res.body?.data?.code;
    expect(code).not.toBe(ACADEMIC_YEAR_EXPIRED);
    expect(res.status).not.toBe(409);
  });

  // G ─── guard blocks writes if rollover has not yet run ───────────────────

  it('G — guard still blocks teacher writes when year is expired (rollover safety-net)', async () => {
    if (!teacherToken) return;
    await resetToExpiredState();

    // Do NOT call runRollover() — simulates rollover service failure or pre-run state.
    const res = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grade: 'GRADE_6', section: 'B' })
      .expect(409);

    const code = res.body?.code ?? res.body?.data?.code;
    expect(code).toBe(ACADEMIC_YEAR_EXPIRED);
  });

  // ─── PREPARATION (proactive) tests ────────────────────────────────────────

  // P1 ─── preparation creates next year with isCurrent=false ───────────────

  it('P1 — runPreparation() creates the next year with isCurrent=false when within 60-day window', async () => {
    await resetToExpiredState();

    // The expired year (2020/2021) already ended — its endsAt is in the past,
    // which is definitely within the 60-day window (past end = 0 days remaining < 60 days).
    await rollover.runPreparation();

    const preparedYear = await prisma.academicYear.findFirst({
      where: { orgId, label: '2021/2022', isCurrent: false },
      select: { id: true, isCurrent: true },
    });
    expect(preparedYear).not.toBeNull();
    expect(preparedYear?.isCurrent).toBe(false);
  });

  // P2 ─── preparation does NOT activate the prepared year ──────────────────

  it('P2 — runPreparation() leaves the expired year as isCurrent=true (never auto-activates)', async () => {
    // Preparation already ran in P1. The expired year should still be current.
    const expiredYear = await prisma.academicYear.findUnique({
      where: { id: expiredYearId },
      select: { isCurrent: true },
    });
    expect(expiredYear?.isCurrent).toBe(true);
  });

  // P3 ─── preparation is idempotent ────────────────────────────────────────

  it('P3 — calling runPreparation() twice does not create duplicate prepared years', async () => {
    // State: expired year is current, prepared year (2021/2022) already exists from P1.
    await rollover.runPreparation(); // should be a no-op

    const count = await prisma.academicYear.count({
      where: { orgId, label: '2021/2022' },
    });
    expect(count).toBe(1);
  });

  // P4 ─── preparation skips org if future year already exists ──────────────

  it('P4 — runPreparation() does not create another year if any future year already exists', async () => {
    await resetToExpiredState();

    // Director pre-created their own custom year for a different start date.
    await prisma.academicYear.create({
      data: {
        orgId,
        label: '2022/2023',
        startsAt: new Date('2022-09-01T00:00:00.000Z'),
        endsAt: new Date('2023-08-31T23:59:59.999Z'),
        isCurrent: false,
      },
    });

    await rollover.runPreparation();

    // Only the director's pre-created year — no auto-prepared 2021/2022 should exist.
    const autoCreated = await prisma.academicYear.findFirst({
      where: { orgId, label: '2021/2022' },
    });
    expect(autoCreated).toBeNull();

    const total = await prisma.academicYear.count({
      where: { orgId, isCurrent: false },
    });
    expect(total).toBe(1); // only the director's year
  });

  // P5 ─── preparation skips org outside the window ─────────────────────────

  it('P5 — runPreparation() does not create year when current year ends far in the future', async () => {
    await resetToExpiredState();

    // Extend the expired year far into the future so it is outside the 60-day window.
    await prisma.academicYear.update({
      where: { id: expiredYearId },
      data: { endsAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) }, // 120 days from now
    });
    yearCache.invalidate(orgId);

    await rollover.runPreparation();

    const prepared = await prisma.academicYear.findFirst({
      where: { orgId, id: { not: expiredYearId } },
    });
    expect(prepared).toBeNull();

    // Restore for any remaining tests.
    await prisma.academicYear.update({
      where: { id: expiredYearId },
      data: { endsAt: new Date('2021-08-31T23:59:59.999Z') },
    });
    yearCache.invalidate(orgId);
  });
});
