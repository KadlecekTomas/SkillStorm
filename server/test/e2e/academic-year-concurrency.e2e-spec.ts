/**
 * E2E: Real concurrency test for DB invariant "at most one current academic year per org".
 *
 * 1) Seed org with two academic years A and B (both isCurrent=false).
 * 2) Run in parallel: PATCH /academic-years/:A/activate and PATCH /academic-years/:B/activate.
 * 3) Expect: one 200, one 409 with MULTIPLE_CURRENT_YEARS_FOR_ORG.
 * 4) Assert DB: exactly one year has isCurrent=true and it matches the successful activation.
 *
 * Requires Postgres (e.g. docker-compose) in CI.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { OrganizationType } from '@prisma/client';
import { authAs } from 'test/helpers';
import { RegisterMode } from '@/auth/dto/register.dto';
import { MULTIPLE_CURRENT_YEARS_FOR_ORG } from '@/academic-years/academic-years.service';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Academic year concurrency – one current per org (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('parallel activate A and B: one 200, one 409 MULTIPLE_CURRENT_YEARS_FOR_ORG; DB has exactly one current', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `concur_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: `Concurrency Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
    expect(orgId).toBeTruthy();

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ orgId })
      .expect(201);
    const token =
      (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;
    expect(token).toBeTruthy();

    const server = app.getHttpServer();
    const years = await prisma.academicYear.findMany({
      where: { orgId },
      select: { id: true, label: true },
      orderBy: { startsAt: 'asc' },
    });
    expect(years.length).toBeGreaterThanOrEqual(1);

    let idA: string;
    let idB: string;
    if (years.length >= 2) {
      idA = years[0].id;
      idB = years[1].id;
    } else {
      const yearA = years[0];
      const createB = await request(server)
        .post('/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({ startYear: 2026, isActive: false })
        .expect(201);
      idB = unwrap(createB)?.id ?? createB.body?.id;
      idA = yearA.id;
    }

    await prisma.academicYear.updateMany({
      where: { orgId },
      data: { isCurrent: false },
    });

    const [resA, resB] = await Promise.all([
      request(server)
        .patch(`/academic-years/${idA}/activate`)
        .set('Authorization', `Bearer ${token}`),
      request(server)
        .patch(`/academic-years/${idB}/activate`)
        .set('Authorization', `Bearer ${token}`),
    ]);

    const okRes = resA.status === 200 ? resA : resB;
    const conflictRes = resA.status === 409 ? resA : resB;
    expect(okRes.status).toBe(200);
    expect(conflictRes.status).toBe(409);

    const conflictCode =
      conflictRes.body?.code ?? conflictRes.body?.meta?.code ?? conflictRes.body?.response?.code;
    expect(conflictCode).toBe(MULTIPLE_CURRENT_YEARS_FOR_ORG);

    const currentInDb = await prisma.academicYear.findMany({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    expect(currentInDb.length).toBe(1);
    const currentId = currentInDb[0]!.id;
    const okYearId = unwrap(okRes)?.id ?? okRes.body?.id;
    expect(okYearId).toBeTruthy();
    expect(currentId).toBe(okYearId);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });
});
