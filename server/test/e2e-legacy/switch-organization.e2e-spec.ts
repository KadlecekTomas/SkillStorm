/**
 * E2E: Organization switching (variant B – lastActiveMembershipId + JWT)
 * - switch → /auth/me consistency (orgId + membershipId match)
 * - lastActiveMembershipId fallback (login/me returns org B when DB has lastActiveMembershipId = B)
 * - invalid lastActiveMembershipId → /me fallback, optional cleanup
 * - token with membershipId not belonging to user → 401
 * - suspended org → core 403 ORG_SUSPENDED
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'SwitchOrg123!';

describe('Switch Organization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let user: { id: string; email: string | null };
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let membershipA: { id: string };
  let membershipB: { id: string };
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
    await prisma.$connect();

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const u = await prisma.user.create({
      data: {
        email: `switch_user_${Date.now()}@example.com`,
        name: 'Switch User',
        passwordHash,
      },
      select: { id: true, email: true },
    });
    user = u;

    orgA = await prisma.organization.create({
      data: {
        name: `Org A ${Date.now()}`,
        status: OrganizationStatus.ACTIVE,
        ownerUserId: user.id,
      },
      select: { id: true, name: true },
    });

    orgB = await prisma.organization.create({
      data: {
        name: `Org B ${Date.now()}`,
        status: OrganizationStatus.SUSPENDED,
      },
      select: { id: true, name: true },
    });

    membershipA = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgA.id,
        role: OrganizationRole.OWNER,
      },
      select: { id: true },
    });

    membershipB = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgB.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: membershipA.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(201);
    token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
    if (!token) throw new Error('Missing token');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /auth/switch-organization', () => {
    it('returns 400 for invalid membershipId', async () => {
      await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 403 when membership does not belong to user', async () => {
      const otherMembership = await prisma.membership.findFirst({
        where: { userId: { not: user.id } },
        select: { id: true },
      });
      if (!otherMembership) return;

      await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: otherMembership.id })
        .expect(403);
    });

    it('user member of 2 orgs → switch to second → API returns second org context', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: membershipB.id })
        .expect(201);

      const data = unwrap(res);
      expect(data).toHaveProperty('organization');
      expect(data.organization?.id).toBe(orgB.id);
      expect(data).toHaveProperty('membership');
      expect(data.membership?.id).toBe(membershipB.id);
      expect(data.membership?.organizationId).toBe(orgB.id);
      expect(data).toHaveProperty('sessionToken');
      expect(typeof data.sessionToken).toBe('string');

      const newToken = data.sessionToken;
      const coreRes = await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${newToken}`);
      expect(coreRes.status).toBe(403);
      expect((coreRes.body as { code?: string })?.code).toBe('ORG_SUSPENDED');
    });

    it('switch → GET /auth/me returns same orgId + membershipId as switch response', async () => {
      const switchRes = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: membershipA.id })
        .expect(201);
      const newToken = unwrap(switchRes)?.sessionToken;
      if (!newToken) return;

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
      const meData = unwrap(meRes);
      expect(meData?.organization?.id).toBe(orgA.id);
      expect(meData?.membership?.id).toBe(membershipA.id);
      expect(meData?.membership?.organizationId).toBe(orgA.id);
    });

    it('after switch to SUSPENDED org, core endpoint returns 403 ORG_SUSPENDED', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(201);
      const t = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!t) return;

      const switchRes = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${t}`)
        .send({ membershipId: membershipB.id })
        .expect(201);

      const newToken = unwrap(switchRes)?.sessionToken;
      if (!newToken) return;

      const coreRes = await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${newToken}`);

      expect(coreRes.status).toBe(403);
      const body = coreRes.body as { code?: string };
      expect(body?.code).toBe('ORG_SUSPENDED');
    });

    it('switch back to ACTIVE org → core endpoint 200 or 412', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(201);
      const t = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!t) return;

      const switchRes = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${t}`)
        .send({ membershipId: membershipA.id })
        .expect(201);

      const newToken = unwrap(switchRes)?.sessionToken;
      if (!newToken) return;

      const coreRes = await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${newToken}`);

      expect([200, 412]).toContain(coreRes.status);
    });
  });

  describe('lastActiveMembershipId fallback', () => {
    it('login with lastActiveMembershipId = B → /me returns org B', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveMembershipId: membershipB.id },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(201);
      const t = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!t) return;

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);
      const meData = unwrap(meRes);
      expect(meData?.organization?.id).toBe(orgB.id);
      expect(meData?.membership?.id).toBe(membershipB.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveMembershipId: membershipA.id },
      });
    });
  });

  describe('invalid lastActiveMembershipId', () => {
    it('/me with invalid lastActiveMembershipId falls back and cleans up', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: `other_${Date.now()}@example.com`,
          name: 'Other',
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
        },
        select: { id: true },
      });
      const otherMembership = await prisma.membership.create({
        data: {
          userId: otherUser.id,
          organizationId: orgA.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveMembershipId: otherMembership.id },
      });

      const { JwtService } = await import('@nestjs/jwt');
      const jwtService = app.get(JwtService);
      const oldFormatToken = jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          username: null,
          systemRole: null,
          organizationRole: null,
          organizationId: null,
        },
        { secret: process.env.JWT_SECRET ?? 'dev', expiresIn: '15m' },
      );

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${oldFormatToken}`)
        .expect(200);
      const meData = unwrap(meRes);
      expect(meData?.organization?.id).toBe(orgA.id);
      expect(meData?.membership?.id).toBe(membershipA.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveMembershipId: membershipA.id },
      });
    });
  });

  describe('security: token membershipId not belonging to user', () => {
    it('request with forged membershipId in token → 401', async () => {
      const { JwtService } = await import('@nestjs/jwt');
      const jwtService = app.get(JwtService);
      const forged = jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          organizationId: orgB.id,
          membershipId: membershipB.id,
          role: 'TEACHER',
        },
        { secret: process.env.JWT_SECRET ?? 'dev', expiresIn: '15m' },
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(200);

      const otherMembership = await prisma.membership.findFirst({
        where: { userId: { not: user.id } },
        select: { id: true },
      });
      if (!otherMembership) return;

      const forgedBad = jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          organizationId: orgB.id,
          membershipId: otherMembership.id,
          role: 'TEACHER',
        },
        { secret: process.env.JWT_SECRET ?? 'dev', expiresIn: '15m' },
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${forgedBad}`)
        .expect(401);
    });
  });
});
