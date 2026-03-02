// test/e2e/tests-axis.e2e-spec.ts
/**
 * Test–Subject–AcademicYear axis hardening (e2e)
 *
 * 1. Cross-tenant subject   → 400 SUBJECT_NOT_FOUND
 * 2. Cross-tenant year      → 400 INVALID_ACADEMIC_YEAR
 * 3. Missing subjectId      → 400 (ValidationPipe)
 * 4. academicYearId omitted → 201 + response uses active year (NO_ACTIVE_ACADEMIC_YEAR path not hit)
 * 5. GET filter by subjectId → only matching tests returned
 * 6. Soft-deleted subject   → 400 SUBJECT_NOT_FOUND
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

describe('Tests Axis — Subject & AcademicYear invariant guards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgAId: string;
  let orgBId: string;
  let tokenA: string; // director of orgA
  let subjectAId: string;
  let subjectBId: string;
  let yearAId: string;
  let yearBId: string;
  let userIds: string[];

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

    const ts = Date.now();
    const ctxA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `axis_A_${ts}`,
    });
    const ctxB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `axis_B_${ts}`,
    });

    orgAId = ctxA.organization.id;
    orgBId = ctxB.organization.id;
    tokenA = ctxA.owner.accessToken;
    userIds = [ctxA.owner.user.id, ctxB.owner.user.id];

    await prisma.organization.updateMany({
      where: { id: { in: [orgAId, orgBId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const [yearA, yearB] = await Promise.all([
      prisma.academicYear.findFirst({
        where: { orgId: orgAId, isCurrent: true },
        select: { id: true },
      }),
      prisma.academicYear.findFirst({
        where: { orgId: orgBId, isCurrent: true },
        select: { id: true },
      }),
    ]);
    if (!yearA || !yearB) {
      throw new Error('Missing current academic year in fixture org');
    }
    yearAId = yearA.id;
    yearBId = yearB.id;

    const [subjectA, subjectB] = await Promise.all([
      prisma.subject.create({
        data: { organizationId: orgAId, name: 'Axis Subject A' },
        select: { id: true },
      }),
      prisma.subject.create({
        data: { organizationId: orgBId, name: 'Axis Subject B' },
        select: { id: true },
      }),
    ]);
    subjectAId = subjectA.id;
    subjectBId = subjectB.id;
  });

  afterAll(async () => {
    if (orgAId && orgBId) {
      await prisma.test.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.subject.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.membership.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
    }
    if (userIds?.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ----- 1. Cross-tenant subject -----

  it('POST /tests with cross-tenant subjectId → 400 SUBJECT_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Cross-tenant subject attack',
        subjectId: subjectBId, // belongs to orgB, not orgA
        academicYearId: yearAId,
      })
      .expect(400);

    expect(res.body.code).toBe('SUBJECT_NOT_FOUND');
  });

  // ----- 2. Cross-tenant academicYear -----

  it('POST /tests with cross-tenant academicYearId → 400 INVALID_ACADEMIC_YEAR', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Cross-tenant year attack',
        subjectId: subjectAId, // valid for orgA
        academicYearId: yearBId, // belongs to orgB, not orgA
      })
      .expect(400);

    expect(res.body.code).toBe('INVALID_ACADEMIC_YEAR');
  });

  // ----- 3. Missing subjectId → ValidationPipe 400 -----

  it('POST /tests without subjectId → 400 validation error', async () => {
    await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Missing subject test',
        academicYearId: yearAId,
        // subjectId intentionally omitted
      })
      .expect(400);
  });

  // ----- 4. academicYearId omitted → falls back to active year -----

  it('POST /tests without academicYearId → 201, response includes active year', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Fallback Year Test',
        subjectId: subjectAId,
        // academicYearId omitted → service resolves from ctx.activeAcademicYearId
      })
      .expect(201);

    const body = unwrap(res);
    expect(body.id).toBeTruthy();
    expect(body.academicYear?.id).toBe(yearAId);
    expect(body.subject?.id).toBe(subjectAId);
  });

  // ----- 5. GET /tests?subjectId= filter -----

  it('GET /tests?subjectId=X → returns only tests belonging to that subject', async () => {
    // Ensure at least one more test with subjectA exists
    await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Subject Filter Test', subjectId: subjectAId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/tests?subjectId=${subjectAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = unwrap(res);
    const items: { subject?: { id: string } }[] = body.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.subject?.id).toBe(subjectAId);
    }
  });

  // ----- 6. Soft-deleted subject → 400 SUBJECT_NOT_FOUND -----

  it('POST /tests with soft-deleted subjectId → 400 SUBJECT_NOT_FOUND', async () => {
    const toDelete = await prisma.subject.create({
      data: { organizationId: orgAId, name: 'Ephemeral Subject' },
      select: { id: true },
    });
    await prisma.subject.update({
      where: { id: toDelete.id },
      data: { deletedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Soft-deleted subject test',
        subjectId: toDelete.id,
        academicYearId: yearAId,
      })
      .expect(400);

    expect(res.body.code).toBe('SUBJECT_NOT_FOUND');

    // Cleanup — force-delete the soft-deleted subject
    await prisma.subject.delete({ where: { id: toDelete.id } });
  });

  // ----- 7. Soft-deleted academic year -----
  // Soft-delete the year while keeping isCurrent=true so RequireCurrentAcademicYearGuard
  // still passes (it only checks isCurrent, not deletedAt). Our service layer then
  // catches the soft-deleted state in resolveAcademicYear().

  describe('soft-deleted academic year', () => {
    beforeAll(async () => {
      // Soft-delete yearA while preserving isCurrent=true so the guard doesn't block us
      await prisma.academicYear.update({
        where: { id: yearAId },
        data: { deletedAt: new Date() },
      });
    });

    afterAll(async () => {
      // Restore yearA so afterAll of the outer describe can proceed cleanly
      await prisma.academicYear.update({
        where: { id: yearAId },
        data: { deletedAt: null },
      });
    });

    it('7a — POST without academicYearId (fallback path) → 400 NO_ACTIVE_ACADEMIC_YEAR', async () => {
      // ctx.activeAcademicYearId still points to yearAId (isCurrent=true, cache may be warm)
      // resolveAcademicYear verifies against DB with deletedAt=null → not found
      const res = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Fallback soft-deleted year test',
          subjectId: subjectAId,
          // no academicYearId — triggers fallback
        })
        .expect(400);

      expect(res.body.code).toBe('NO_ACTIVE_ACADEMIC_YEAR');
    });

    it('7b — POST with explicit soft-deleted academicYearId → 400 INVALID_ACADEMIC_YEAR', async () => {
      // Explicit yearAId provided but deletedAt is set — service rejects it
      const res = await request(app.getHttpServer())
        .post('/tests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Explicit soft-deleted year test',
          subjectId: subjectAId,
          academicYearId: yearAId,
        })
        .expect(400);

      expect(res.body.code).toBe('INVALID_ACADEMIC_YEAR');
    });
  });
});
