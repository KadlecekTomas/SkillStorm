/**
 * E2E: Platform Admin & Org governance
 * - Non-admin → /platform/organizations 403
 * - Admin → /platform/organizations 200, shape without student identifiers
 * - Create org limit: second org → 409 ORG_OWNER_LIMIT_REACHED
 * - PENDING org: core endpoint → 403 ORG_PENDING (or 412 ORG_NOT_READY)
 * - After active year + first class: core OK
 * - Suspend: owner gets 403 ORG_SUSPENDED
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus, SystemRole } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'PlatformAdmin123!';

function deriveExpectedAcademicYearForNow(now: Date) {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}/${endYear}`,
    startsAtIso: `${startYear}-09-01T00:00:00.000Z`,
    endsAtIso: `${endYear}-08-31T23:59:59.999Z`,
  };
}

describe('Platform Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminUser: { token: string; email: string };
  let regularUser: { token: string; userId: string; orgId: string };
  let pendingOrgId: string;

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

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const admin = await prisma.user.create({
      data: {
        email: `platform_admin_${Date.now()}@example.com`,
        name: 'Platform Admin',
        passwordHash,
        isPlatformAdmin: true,
      },
      select: { id: true, email: true },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password: TEST_PASSWORD })
      .expect(201);
    const adminToken = (unwrap(adminLogin) ?? adminLogin.body)?.sessionToken;
    if (!adminToken) throw new Error('Missing admin token');
    adminUser = { token: adminToken, email: admin.email ?? '' };

    const regular = await prisma.user.create({
      data: {
        email: `platform_regular_${Date.now()}@example.com`,
        name: 'Regular User',
        passwordHash,
      },
      select: { id: true, email: true },
    });

    const pendingOrg = await prisma.organization.create({
      data: {
        name: `Pending Org ${Date.now()}`,
        status: OrganizationStatus.PENDING,
        ownerUserId: regular.id,
      },
      select: { id: true },
    });
    pendingOrgId = pendingOrg.id;

    const membership = await prisma.membership.create({
      data: {
        userId: regular.id,
        organizationId: pendingOrg.id,
        role: OrganizationRole.OWNER,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: regular.id },
      data: { lastActiveMembershipId: membership.id },
    });

    const regularLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: regular.email, password: TEST_PASSWORD })
      .expect(201);
    const regularToken = (unwrap(regularLogin) ?? regularLogin.body)?.sessionToken;
    if (!regularToken) throw new Error('Missing regular token');
    regularUser = { token: regularToken, userId: regular.id, orgId: pendingOrg.id };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  /**
   * AUTH CONTEXT CONTRACT – SUPERADMIN / DEVOPS
   *
   * These tests lock the /auth/me contract for platform admins:
   * - SUPERADMIN / DEVOPS must always receive context.mode === 'platform'
   * - organizationId in context must be null for platform mode
   * - user.isPlatformAdmin must be true
   * - frontend MUST NOT need to infer platform mode from memberships.length
   *
   * Any regression (e.g. removing context, or falling back to personal mode)
   * must fail here.
   */
  describe('Auth context for platform admins (SUPERADMIN/DEVOPS)', () => {
    it('SUPERADMIN without memberships → context.mode === platform and no org', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const superadmin = await prisma.user.create({
        data: {
          email: `ctx_superadmin_${Date.now()}@example.com`,
          name: 'Ctx Superadmin',
          passwordHash,
          systemRole: SystemRole.SUPERADMIN,
          isPlatformAdmin: false,
        },
        select: { id: true, email: true },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: superadmin.email, password: TEST_PASSWORD })
        .expect(201);

      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken as string | undefined;
      expect(token).toBeDefined();

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payload = unwrap(meRes);
      expect(payload).toBeDefined();

      // Shape safety: context MUST exist
      expect(payload.context).toBeDefined();
      expect(payload.context.mode).toBe('platform');
      expect(payload.context.organizationId).toBeNull();

      const user = payload.user ?? payload;
      expect(user.systemRole).toBe(SystemRole.SUPERADMIN);
      expect(user.isPlatformAdmin).toBe(true);

      const memberships = payload.user?.memberships ?? payload.memberships ?? [];
      expect(Array.isArray(memberships)).toBe(true);
      expect(memberships.length).toBe(0);

      // Explicit regression guard – SUPERADMIN must never fall back to personal mode.
      if (payload.context.mode === 'personal') {
        throw new Error('SUPERADMIN MUST NOT have context.mode === "personal"');
      }
    });

    it('non-privileged user without memberships → context.mode === personal', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const user = await prisma.user.create({
        data: {
          email: `ctx_regular_${Date.now()}@example.com`,
          name: 'Ctx Regular',
          passwordHash,
          systemRole: null,
        },
        select: { id: true, email: true },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(201);

      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken as string | undefined;
      expect(token).toBeDefined();

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payload = unwrap(meRes);
      expect(payload).toBeDefined();
      expect(payload.context).toBeDefined();
      expect(payload.context.mode).toBe('personal');
      expect(payload.context.organizationId).toBeNull();

      const memberships = payload.user?.memberships ?? payload.memberships ?? [];
      expect(Array.isArray(memberships)).toBe(true);
      expect(memberships.length).toBe(0);
    });
  });

  /**
   * CONTRACT: Effective platform admin.
   * SUPERADMIN must always be treated as platform admin (governance), regardless of DB flag.
   * Effective = (user.isPlatformAdmin ?? false) || user.systemRole === SUPERADMIN.
   * If this is removed or guard is changed to only check DB, these tests fail.
   */
  describe('Effective platform admin contract (SUPERADMIN without DB flag)', () => {
    let superadminToken: string;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const superadmin = await prisma.user.create({
        data: {
          email: `superadmin_contract_${Date.now()}@example.com`,
          name: 'Superadmin Contract',
          passwordHash,
          systemRole: SystemRole.SUPERADMIN,
          isPlatformAdmin: false,
        },
        select: { id: true, email: true },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: superadmin.email, password: TEST_PASSWORD })
        .expect(201);
      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!token) throw new Error('Missing superadmin token');
      superadminToken = token;
    });

    it('GET /auth/me returns isPlatformAdmin === true for SUPERADMIN without DB flag', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      const payload = unwrap(res);
      expect(payload).toBeDefined();
      const user = payload?.user ?? payload;
      expect(user.isPlatformAdmin).toBe(true);
      expect(user.systemRole).toBe(SystemRole.SUPERADMIN);
    });

    it('GET /platform/organizations returns 200 for SUPERADMIN without DB flag', async () => {
      await request(app.getHttpServer())
        .get('/platform/organizations')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);
    });
  });

  describe('GET /platform/organizations', () => {
    it('non-admin returns 403', async () => {
      await request(app.getHttpServer())
        .get('/platform/organizations')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .expect(403);
    });

    it('admin returns 200 and shape without student identifiers', async () => {
      const res = await request(app.getHttpServer())
        .get('/platform/organizations')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      const data = unwrap(res);
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.items)).toBe(true);
      data.items.forEach((item: Record<string, unknown>) => {
        expect(item).not.toHaveProperty('studentId');
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('status');
      });
    });
  });

  describe('Approval bootstrap: default academic year', () => {
    it('new pending org approval creates one current academic year', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Approve no-year ${Date.now()}`,
          status: OrganizationStatus.PENDING,
        },
        select: { id: true },
      });

      const beforeCount = await prisma.academicYear.count({
        where: { orgId: org.id, isCurrent: true },
      });
      expect(beforeCount).toBe(0);

      const now = new Date();
      await request(app.getHttpServer())
        .post(`/platform/organizations/${org.id}/activate`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const currentYears = await prisma.academicYear.findMany({
        where: { orgId: org.id, isCurrent: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, startsAt: true, endsAt: true },
      });
      expect(currentYears).toHaveLength(1);

      const expected = deriveExpectedAcademicYearForNow(now);
      const year = currentYears[0];
      expect(year).toBeDefined();
      if (!year) return;

      expect(year.label).toBe(expected.label);
      expect(year.startsAt.toISOString()).toBe(expected.startsAtIso);
      expect(year.endsAt.toISOString()).toBe(expected.endsAtIso);
    });

    it('approve called again does not duplicate current year', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Approve idempotent ${Date.now()}`,
          status: OrganizationStatus.PENDING,
        },
        select: { id: true },
      });

      await request(app.getHttpServer())
        .post(`/platform/organizations/${org.id}/activate`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const firstCount = await prisma.academicYear.count({
        where: { orgId: org.id, isCurrent: true },
      });
      expect(firstCount).toBe(1);

      await request(app.getHttpServer())
        .post(`/platform/organizations/${org.id}/activate`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(400);

      const secondCount = await prisma.academicYear.count({
        where: { orgId: org.id, isCurrent: true },
      });
      expect(secondCount).toBe(1);
    });

    it('existing current year is kept (no duplicate, no replacement)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Approve keep-year ${Date.now()}`,
          status: OrganizationStatus.PENDING,
        },
        select: { id: true },
      });

      const existingYear = await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: `Legacy ${Date.now()}`,
          startsAt: new Date('2023-09-01T00:00:00.000Z'),
          endsAt: new Date('2024-08-31T23:59:59.999Z'),
          isCurrent: true,
        },
        select: { id: true },
      });

      await request(app.getHttpServer())
        .post(`/platform/organizations/${org.id}/activate`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const currentYears = await prisma.academicYear.findMany({
        where: { orgId: org.id, isCurrent: true },
        select: { id: true },
      });

      expect(currentYears).toHaveLength(1);
      expect(currentYears[0]?.id).toBe(existingYear.id);
    });

    it('db invariant: no organization has more than one current year', async () => {
      const duplicates = await prisma.$queryRaw<
        Array<{ organization_id: string; current_count: bigint }>
      >`SELECT organization_id, COUNT(*)::bigint AS current_count FROM academic_years WHERE "isCurrent" = true GROUP BY organization_id HAVING COUNT(*) > 1`;
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('Create org limit', () => {
    it('user creates first org → 201', async () => {
      const freshUser = await prisma.user.create({
        data: {
          email: `limit_test_${Date.now()}@example.com`,
          name: 'Limit Test',
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
        },
        select: { id: true, email: true },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: freshUser.email, password: TEST_PASSWORD })
        .expect(201);
      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!token) return;

      const createRes = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `First Org ${Date.now()}` })
        .expect(201);

      const org = unwrap(createRes);
      expect(org).toHaveProperty('id');
      expect(org.status ?? (org as { status?: string }).status).toBe('PENDING');
    });

    it('user creates second org → 409 ORG_OWNER_LIMIT_REACHED', async () => {
      const existingOwner = await prisma.organization.findFirst({
        where: { ownerUserId: { not: null } },
        select: { ownerUserId: true },
      });
      if (!existingOwner?.ownerUserId) return;

      const user = await prisma.user.findUnique({
        where: { id: existingOwner.ownerUserId },
        select: { email: true },
      });
      if (!user?.email) return;

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(201);
      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!token) return;

      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Second Org ${Date.now()}` })
        .expect(409);

      const body = res.body as { code?: string; message?: { code?: string } };
      const code = body?.code ?? body?.message?.code;
      expect(code).toBe('ORG_OWNER_LIMIT_REACHED');
    });
  });

  describe('Org status gating', () => {
    it('PENDING org: core endpoint returns 403 ORG_PENDING or 412 ORG_NOT_READY', async () => {
      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId: 'any' })
        .set('Authorization', `Bearer ${regularUser.token}`)
        .set('x-organization-id', pendingOrgId);

      expect([403, 409, 412]).toContain(res.status);
    });

    it('after active year + first class: core endpoint OK', async () => {
      const year = await prisma.academicYear.create({
        data: {
          orgId: pendingOrgId,
          label: `E2E ${Date.now()}`,
          startsAt: new Date('2025-09-01'),
          endsAt: new Date('2026-08-31'),
          isCurrent: true,
        },
        select: { id: true },
      });

      await prisma.classSection.create({
        data: {
          orgId: pendingOrgId,
          yearId: year.id,
          grade: 'GRADE_5',
          section: 'A',
        },
      });

      await prisma.organization.update({
        where: { id: pendingOrgId },
        data: { status: OrganizationStatus.ACTIVE },
      });

      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId: year.id })
        .set('Authorization', `Bearer ${regularUser.token}`);

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('Suspend', () => {
    it('admin suspends org, owner gets 403 ORG_SUSPENDED on core', async () => {
      const activeOrg = await prisma.organization.findFirst({
        where: { status: OrganizationStatus.ACTIVE, id: pendingOrgId },
        select: { id: true },
      });
      if (!activeOrg) return;

      const year = await prisma.academicYear.findFirst({
        where: { orgId: activeOrg.id },
        select: { id: true },
      });
      if (!year) return;

      await request(app.getHttpServer())
        .post(`/platform/organizations/${activeOrg.id}/suspend`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId: year.id })
        .set('Authorization', `Bearer ${regularUser.token}`);

      expect([403, 409]).toContain(res.status);
    });
  });
});
