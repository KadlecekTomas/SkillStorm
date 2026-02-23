/**
 * E2E: Organization join flow (production token-based invitations).
 *
 * 1. GET /invitations/preview?token= → valid preview, invalid/expired → 400
 * 2. POST /invitations/accept { token } → new member 201
 * 3. Already member → accept 201 idempotent
 * 4. Expired token → preview & accept 400
 * 5. Already used token (maxUses=1) → accept 400
 * 6. User with existing org joins second org → 201 (multi-org)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { addDays, subDays } from 'date-fns';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { InvitationType, OrganizationRole } from '@prisma/client';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const PASSWORD = 'JoinFlow123!';

describe('Join flow – invitations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /invitations/preview', () => {
    it('valid token returns organization preview', async () => {
      const org = await prisma.organization.create({
        data: { name: `Join Preview Org ${Date.now()}` },
        select: { id: true, name: true },
      });
      const code = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await prisma.invite.create({
        data: {
          organizationId: org.id,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code,
          code,
          expiresAt: addDays(new Date(), 7),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/invitations/preview?token=${encodeURIComponent(code)}`)
        .expect(200);
      const data = unwrap(res);
      expect(data).toMatchObject({
        type: 'ORG_ONLY',
        organizationId: org.id,
        organizationName: org.name,
      });
    });

    it('invalid token returns 400 (constant-time message)', async () => {
      const res = await request(app.getHttpServer())
        .get('/invitations/preview?token=invalid-nonexistent-token-xyz')
        .expect(400);
      expect(res.body?.message || res.body?.error).toBeTruthy();
    });

    it('expired token returns 400', async () => {
      const org = await prisma.organization.create({
        data: { name: `Join Expired Org ${Date.now()}` },
        select: { id: true },
      });
      const code = `expired_${Date.now()}`;
      await prisma.invite.create({
        data: {
          organizationId: org.id,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code,
          code,
          expiresAt: subDays(new Date(), 1),
        },
      });

      await request(app.getHttpServer())
        .get(`/invitations/preview?token=${encodeURIComponent(code)}`)
        .expect(400);
    });
  });

  describe('POST /invitations/accept', () => {
    let orgId: string;
    let inviteCode: string;
    let userNoOrg: { id: string; email: string; token: string };
    let userWithOrg: { id: string; email: string; token: string; orgId: string };

    beforeAll(async () => {
      const org = await prisma.organization.create({
        data: { name: `Join Accept Org ${Date.now()}` },
        select: { id: true },
      });
      orgId = org.id;

      const code = `accept_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      await prisma.invite.create({
        data: {
          organizationId: orgId,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code,
          code,
          expiresAt: addDays(new Date(), 7),
        },
      });
      inviteCode = code;

      const hash = await bcrypt.hash(PASSWORD, 10);
      const u1 = await prisma.user.create({
        data: {
          email: `join_no_org_${Date.now()}@example.com`,
          name: 'User No Org',
          passwordHash: hash,
        },
        select: { id: true, email: true },
      });
      const login1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: u1.email, password: PASSWORD })
        .expect(201);
      const token1 = (unwrap(login1) ?? login1.body)?.sessionToken;
      if (!token1) throw new Error('Missing token');
      userNoOrg = { id: u1.id, email: u1.email!, token: token1 };

      const org2 = await prisma.organization.create({
        data: { name: `Other Org ${Date.now()}` },
        select: { id: true },
      });
      const u2 = await prisma.user.create({
        data: {
          email: `join_has_org_${Date.now()}@example.com`,
          name: 'User Has Org',
          passwordHash: hash,
        },
        select: { id: true, email: true },
      });
      const m2 = await prisma.membership.create({
        data: {
          userId: u2.id,
          organizationId: org2.id,
          role: OrganizationRole.DIRECTOR,
        },
        select: { id: true },
      });
      await prisma.user.update({
        where: { id: u2.id },
        data: { lastActiveMembershipId: m2.id },
      });
      const login2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: u2.email, password: PASSWORD })
        .expect(201);
      const token2 = (unwrap(login2) ?? login2.body)?.sessionToken;
      if (!token2) throw new Error('Missing token');
      userWithOrg = { id: u2.id, email: u2.email!, token: token2, orgId: org2.id };
    });

    it('authenticated user without org accepts → 201, has membership', async () => {
      const res = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${userNoOrg.token}`)
        .send({ token: inviteCode })
        .expect(201);
      const data = unwrap(res);
      expect(data.membership).toBeDefined();
      expect(data.membership.organizationId).toBe(orgId);
      expect(data.organization?.id).toBe(orgId);
    });

    it('already member accepts again → 201 idempotent', async () => {
      const res = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${userNoOrg.token}`)
        .send({ token: inviteCode })
        .expect(201);
      const data = unwrap(res);
      expect(data.membership).toBeDefined();
      expect(data.membership.organizationId).toBe(orgId);
    });

    it('user with existing org joins second org → 201 (multi-org)', async () => {
      const code2 = `multi_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const orgSecond = await prisma.organization.create({
        data: { name: `Second Org ${Date.now()}` },
        select: { id: true },
      });
      await prisma.invite.create({
        data: {
          organizationId: orgSecond.id,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code2,
          code: code2,
          expiresAt: addDays(new Date(), 7),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${userWithOrg.token}`)
        .send({ token: code2 })
        .expect(201);
      const data = unwrap(res);
      expect(data.membership).toBeDefined();
      expect(data.membership.organizationId).toBe(orgSecond.id);

      const memberships = await prisma.membership.findMany({
        where: { userId: userWithOrg.id },
        select: { organizationId: true },
      });
      expect(memberships.length).toBe(2);
      expect(memberships.map((m) => m.organizationId).sort()).toEqual(
        [userWithOrg.orgId, orgSecond.id].sort(),
      );
    });

    it('expired token → 400', async () => {
      const org = await prisma.organization.create({
        data: { name: `Expired Accept Org ${Date.now()}` },
        select: { id: true },
      });
      const code = `exp_accept_${Date.now()}`;
      await prisma.invite.create({
        data: {
          organizationId: org.id,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code,
          code,
          expiresAt: subDays(new Date(), 1),
        },
      });
      const hash = await bcrypt.hash(PASSWORD, 10);
      const u = await prisma.user.create({
        data: {
          email: `exp_${Date.now()}@example.com`,
          name: 'Exp User',
          passwordHash: hash,
        },
        select: { id: true, email: true },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: u.email, password: PASSWORD })
        .expect(201);
      const token = (unwrap(login) ?? login.body)?.sessionToken;
      if (!token) throw new Error('Missing token');

      await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: code })
        .expect(400);
    });

    it('already used token (maxUses=1) → 400', async () => {
      const org = await prisma.organization.create({
        data: { name: `Single Use Org ${Date.now()}` },
        select: { id: true },
      });
      const code = `single_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await prisma.invite.create({
        data: {
          organizationId: org.id,
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          token: code,
          code,
          expiresAt: addDays(new Date(), 7),
          maxUses: 1,
          usedCount: 1,
        },
      });
      const hash = await bcrypt.hash(PASSWORD, 10);
      const u = await prisma.user.create({
        data: {
          email: `single_${Date.now()}@example.com`,
          name: 'Single User',
          passwordHash: hash,
        },
        select: { id: true, email: true },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: u.email, password: PASSWORD })
        .expect(201);
      const token = (unwrap(login) ?? login.body)?.sessionToken;
      if (!token) throw new Error('Missing token');

      await request(app.getHttpServer())
        .post('/invitations/accept')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: code })
        .expect(400);
    });
  });
});
