// test/e2e/academic-year-single-current.e2e-spec.ts
/**
 * Enforces the "single non-deleted current year per org" invariant at the service layer.
 *
 * 8a — POST /academic-years with isActive=true while a current year already exists
 *      → 400 CURRENT_YEAR_ALREADY_EXISTS (pre-flight guard in service)
 *
 * 8b — Soft-delete the existing current year, then POST /academic-years with isActive=true
 *      → 201 (index slot is free; the soft-deleted year no longer counts)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { CURRENT_YEAR_ALREADY_EXISTS } from '@/academic-years/academic-years.service';
import { setupOrgContext } from 'test/helpers';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Academic year — single current year enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let directorToken: string;
  let existingYearId: string;
  let userIds: string[];

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
      role: 'DIRECTOR',
      seed: `single_current_${Date.now()}`,
    });

    orgId = ctx.organization.id;
    directorToken = ctx.owner.accessToken;
    userIds = [ctx.owner.user.id];

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // The org always has exactly one current year from registration
    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) throw new Error('Expected org to have a current academic year from registration');
    existingYearId = year.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.test.deleteMany({ where: { organizationId: orgId } });
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

  // ----- 8a: isActive=true with existing active year → 400 -----

  it('8a — POST /academic-years with isActive=true while current year exists → 400 CURRENT_YEAR_ALREADY_EXISTS', async () => {
    // The org has existingYearId as isCurrent=true and deleted_at IS NULL.
    // Attempting to create another with isActive=true must be rejected by the service guard.
    const res = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ startYear: 2020, isActive: true })
      .expect(400);

    expect(res.body.code).toBe(CURRENT_YEAR_ALREADY_EXISTS);

    // DB still has exactly one current year
    const count = await prisma.academicYear.count({
      where: { orgId, isCurrent: true, deletedAt: null },
    });
    expect(count).toBe(1);
  });

  // ----- 8b: soft-delete existing year, then isActive=true succeeds -----

  it('8b — After soft-deleting the current year, POST /academic-years with isActive=true → 201', async () => {
    // Soft-delete the existing current year: keeps isCurrent=true but deleted_at != null,
    // so it no longer occupies the partial unique index slot.
    await prisma.academicYear.update({
      where: { id: existingYearId },
      data: { deletedAt: new Date() },
    });

    // Now the pre-flight guard (deletedAt: null) finds no blocking year → allows creation.
    const res = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ startYear: 2020, isActive: true })
      .expect(201);

    const body = unwrap(res);
    expect(body.id).toBeTruthy();
    expect(body.isActive).toBe(true);

    // DB: one new active year, existingYearId is soft-deleted
    const activeCount = await prisma.academicYear.count({
      where: { orgId, isCurrent: true, deletedAt: null },
    });
    expect(activeCount).toBe(1);
  });
});
