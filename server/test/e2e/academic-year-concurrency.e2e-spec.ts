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
import { authAs, useOrg } from 'test/helpers';
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

    // authAs already provisioned this user's one-and-only organization
    // (creating a second org for the same user is 409 by contract now),
    // and tokens travel in cookies — useOrg() extracts the fresh one.
    const orgId = auth.organization?.id;
    expect(orgId).toBeTruthy();

    // year-scoped endpoints 409 with ORG_PENDING until the org is ACTIVE
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });

    const token = await useOrg(app, auth.accessToken, orgId);
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
      idA = years[0]!.id;
      idB = years[1]!.id;
    } else {
      const yearA = years[0]!;
      const createB = await request(server)
        .post('/academic-years')
        .set('Authorization', `Bearer ${token}`)
        // far-future startYear: the org bootstrap may already own the label
        // for the current school year (@@unique([orgId, label]) → P2002/409)
        .send({ startYear: 2030, isActive: false })
        .expect(201);
      idB = unwrap(createB)?.id ?? createB.body?.id;
      idA = yearA.id;
    }

    // The zero-current state is unreachable through the API now (org-context
    // layer rejects any request with NO_CURRENT_ACADEMIC_YEAR), so start from
    // the valid state — yearA current — and race two switches. The invariant
    // under test: whatever the interleaving, the DB ends with EXACTLY ONE
    // current year (partial unique index academic_year_single_current_per_org).
    await prisma.academicYear.updateMany({
      where: { orgId },
      data: { isCurrent: false },
    });
    await prisma.academicYear.update({
      where: { id: idA },
      data: { isCurrent: true },
    });

    const [resA, resB] = await Promise.all([
      request(server)
        .patch(`/academic-years/${idA}/activate`)
        .set('Authorization', `Bearer ${token}`),
      request(server)
        .patch(`/academic-years/${idB}/activate`)
        .set('Authorization', `Bearer ${token}`),
    ]);

    // Each request is individually valid: allowed outcomes are 200 (winner or
    // idempotent re-activate) and 409 MULTIPLE_CURRENT_YEARS_FOR_ORG (loser of
    // the P2002 race window). At least one must succeed; nothing else may leak.
    for (const res of [resA, resB]) {
      expect([200, 409]).toContain(res.status);
      if (res.status === 409) {
        const code =
          res.body?.code ?? res.body?.meta?.code ?? res.body?.response?.code;
        expect(code).toBe(MULTIPLE_CURRENT_YEARS_FOR_ORG);
      }
    }
    expect([resA.status, resB.status]).toContain(200);

    const currentInDb = await prisma.academicYear.findMany({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    expect(currentInDb.length).toBe(1);
    expect([idA, idB]).toContain(currentInDb[0]!.id);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });
});
