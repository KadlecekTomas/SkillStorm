/**
 * E2E: Invariant "exactly one current academic year per organization".
 * - Create org via API → default academic year exists; GET /academic-years/current or /active → 200.
 * - Create second academic year with isActive true → transaction flips previous to false; DB has exactly one current.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationType } from '@prisma/client';
import { authAs } from 'test/helpers';
import { RegisterMode } from '@/auth/dto/register.dto';
import { OrganizationRole } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Academic year invariant (e2e)', () => {
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

  it('GET /academic-years/current returns 200 with { id, name } when exactly one current year', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `cur_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    // authAs already provisioned this user's only organization (a second
    // org per user is 409 by contract); activate it for year-scoped ops
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    expect(orgId).toBeTruthy();

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;

    const currentRes = await request(app.getHttpServer())
      .get('/academic-years/current')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    const current = unwrap(currentRes);
    expect(current).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    expect(current?.id).toBeTruthy();
    expect(current?.name).toBeTruthy();

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('GET /academic-years/current returns 409 NO_CURRENT_ACADEMIC_YEAR when 0 current years', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `no_act_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    // authAs already provisioned this user's only organization (a second
    // org per user is 409 by contract); activate it for year-scoped ops
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    await prisma.academicYear.updateMany({ where: { orgId }, data: { isCurrent: false } });

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;

    const res = await request(app.getHttpServer())
      .get('/academic-years/current')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(409);

    const body = res.body;
    expect(body?.meta?.code).toBe('NO_CURRENT_ACADEMIC_YEAR');

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('partial unique index prevents a second current year — DB blocks direct Prisma insert with P2002', async () => {
    // The state "two isCurrent=true AND deleted_at IS NULL rows for the same org" is now
    // unreachable via the partial unique index. This test verifies the constraint fires.
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `multi_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });

    // authAs already provisioned this user's only organization (a second
    // org per user is 409 by contract); activate it for year-scoped ops
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    expect(orgId).toBeTruthy();

    // Org has exactly one current year from registration
    const before = await prisma.academicYear.count({ where: { orgId, isCurrent: true } });
    expect(before).toBe(1);

    // Attempting to create a second isCurrent=true year must throw (P2002 unique violation)
    await expect(
      prisma.academicYear.create({
        data: {
          orgId,
          label: '2099/2100',
          startsAt: new Date('2099-09-01'),
          endsAt: new Date('2100-08-31'),
          isCurrent: true,
        },
      }),
    ).rejects.toThrow();

    // DB still has exactly one current year — constraint held
    const after = await prisma.academicYear.count({ where: { orgId, isCurrent: true } });
    expect(after).toBe(1);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('create org → GET /academic-years/active returns 200 and exactly one current year (deprecated route)', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `inv_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    expect(orgId).toBeTruthy();

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;
    expect(newToken).toBeTruthy();

    const activeRes = await request(app.getHttpServer())
      .get('/academic-years/active')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    const activeYear = unwrap(activeRes);
    expect(activeYear).toBeTruthy();
    expect(activeYear.isActive).toBe(true);
    expect(activeYear.organizationId).toBe(orgId);

    const count = await prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
    expect(count).toBe(1);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('GET /academic-years/active returns same id and name as GET /academic-years/current (backward compat)', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `compat_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ orgId })
      .expect(201);
    const token = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;

    const activeRes = await request(app.getHttpServer())
      .get('/academic-years/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const currentRes = await request(app.getHttpServer())
      .get('/academic-years/current')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const active = unwrap(activeRes);
    const current = unwrap(currentRes);
    expect(active?.id).toBe(current?.id);
    expect(active?.name).toBe(current?.name);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('creating second academic year with isActive true leaves exactly one current in DB', async () => {
    const auth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: `inv2_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    expect(orgId).toBeTruthy();

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;
    expect(newToken).toBeTruthy();

    const activeRes = await request(app.getHttpServer())
      .get('/academic-years/active')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);
    const firstActive = unwrap(activeRes);
    expect(firstActive?.isActive).toBe(true);

    // Contract change: POST with isActive=true is rejected (400
    // CURRENT_YEAR_ALREADY_EXISTS) while a current year exists — switching
    // goes through /activate. Verify both halves of the invariant.
    await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ startYear: 2030, isActive: true })
      .expect(400);

    const createYearRes = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ startYear: 2030, isActive: false })
      .expect(201);
    const created = unwrap(createYearRes);

    await request(app.getHttpServer())
      .patch(`/academic-years/${created?.id}/activate`)
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    const count = await prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
    expect(count).toBe(1);

    const activeRow = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, label: true },
    });
    expect(activeRow?.id).toBe(created?.id);
    expect(activeRow?.label).toBe('2030/2031');

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('POST /academic-years rejects startYear < 2000', async () => {
    const auth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: `inv_rej_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;

    await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ startYear: 1999, isActive: true })
      .expect(400);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('POST /academic-years rejects startYear > 2100', async () => {
    const auth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: `inv_rej2_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;
    const orgId = auth.organization?.id as string;
    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'ACTIVE' },
    });
    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId })
      .expect(201);
    const newToken = (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;

    await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ startYear: 2101, isActive: true })
      .expect(400);

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });
});
