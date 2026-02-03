/**
 * E2E: Foundation invariant – organization context must be consistent.
 *
 * THIS STATE MUST BE IMPOSSIBLE:
 * User owns or is member of an org, but frontend does not see it and onboarding offers create-organization.
 *
 * This test proves that GET /auth/me bootstrap (getMeContext) repairs lastActiveMembershipId
 * when user has memberships but lastActiveMembershipId was null (legacy/corrupt state).
 *
 * Scenario: user owns org, user.lastActiveMembershipId = NULL → getMeContext with minimal claims
 * → response has organization and memberships → DB user.lastActiveMembershipId is persisted.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from '@/auth/auth.service';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'FoundationInv123!';

describe('Foundation: organization context invariant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  let user: { id: string; email: string | null };
  let orgId: string;
  let membershipId: string;
  let token: string;

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
    authService = app.get(AuthService);
    await prisma.$connect();

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const u = await prisma.user.create({
      data: {
        email: `foundation_owner_${Date.now()}@example.com`,
        name: 'Foundation Owner',
        passwordHash,
      },
      select: { id: true, email: true },
    });
    user = u;

    const org = await prisma.organization.create({
      data: {
        name: `Foundation Org ${Date.now()}`,
        status: OrganizationStatus.PENDING,
        ownerUserId: user.id,
      },
      select: { id: true },
    });
    orgId = org.id;

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role: OrganizationRole.OWNER,
      },
      select: { id: true },
    });
    membershipId = membership.id;

    // Simulate legacy/corrupt state: user owns org but lastActiveMembershipId is NULL
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: null },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(201);
    token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken ?? (loginRes.body as any)?.sessionToken;
    if (!token) throw new Error('Missing token after login');
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { id: membershipId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /auth/me returns organization and memberships when user owns org', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = unwrap(res) ?? res.body;
    expect(data).toBeDefined();
    expect(data.organization).toBeDefined();
    expect(data.organization?.id).toBe(orgId);
    expect(data.user?.memberships).toBeDefined();
    expect(Array.isArray(data.user.memberships)).toBe(true);
    expect(data.user.memberships.length).toBeGreaterThan(0);
  });

  it('getMeContext with minimal claims (no membershipId/organizationId) repairs lastActiveMembershipId when user has memberships', async () => {
    // Reset to broken state: user has membership but lastActiveMembershipId = null
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: null },
    });

    const beforeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastActiveMembershipId: true },
    });
    expect(beforeUser?.lastActiveMembershipId).toBeNull();

    // Call getMeContext with minimal claims (simulates legacy token or bootstrap path where claims do not match)
    const ctx = await authService.getMeContext(user.id, {
      membershipId: null,
      organizationId: null,
    });

    expect(ctx.organization).toBeDefined();
    expect(ctx.organization?.id).toBe(orgId);
    expect(ctx.user.memberships).toBeDefined();
    expect(ctx.user.memberships.length).toBeGreaterThan(0);

    const afterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastActiveMembershipId: true },
    });
    expect(afterUser?.lastActiveMembershipId).not.toBeNull();
    expect(afterUser?.lastActiveMembershipId).toBe(membershipId);
  });
});
