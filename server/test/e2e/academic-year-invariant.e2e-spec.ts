/**
 * E2E: Invariant "exactly one active academic year per organization".
 * - Create org via API → default academic year exists; GET /academic-years/active → 200, isActive true.
 * - Create second academic year with isActive true → transaction flips previous to false; DB has exactly one active.
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

  it('GET /academic-years/current returns 200 with { id, name } when exactly one active year', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `cur_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Current Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
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

  it('GET /academic-years/current returns 409 NO_ACTIVE_ACADEMIC_YEAR when 0 active years', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `no_act_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `No Active Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
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
    expect(body?.meta?.code).toBe('NO_ACTIVE_ACADEMIC_YEAR');

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('GET /academic-years/current returns 409 MULTIPLE_ACTIVE_ACADEMIC_YEARS when 2 active years', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `multi_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Multi Active Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
    await prisma.academicYear.create({
      data: {
        orgId,
        label: '2026/2027',
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
    });

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
    expect(body?.meta?.code).toBe('MULTIPLE_ACTIVE_ACADEMIC_YEARS');

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('create org → GET /academic-years/active returns 200 and exactly one active year', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `inv_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Invariant Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const org = unwrap(createOrgRes);
    const orgId = org?.id ?? createOrgRes.body?.id;
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

  it('creating second academic year with isActive true leaves exactly one active in DB', async () => {
    const auth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: `inv2_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });
    const token = auth.accessToken;

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Invariant Org 2 ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const org = unwrap(createOrgRes);
    const orgId = org?.id ?? createOrgRes.body?.id;
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

    const createYearRes = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${newToken}`)
      .send({
        startYear: 2026,
        isActive: true,
      })
      .expect(201);

    const created = unwrap(createYearRes);
    expect(created?.isActive).toBe(true);

    const count = await prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
    expect(count).toBe(1);

    const activeRow = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, label: true },
    });
    expect(activeRow?.id).toBe(created?.id);
    expect(activeRow?.label).toBe('2026/2027');

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
    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Inv Rej Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);
    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
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
    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Inv Rej2 Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);
    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
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
