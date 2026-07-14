// test/e2e/auth.register-modes.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditEntityType, OrganizationRole, OrganizationType } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';
import * as bcrypt from 'bcryptjs';

describe('Auth registration modes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const baseEmail = () => `reg-modes-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const createInviteForOrg = async (orgId: string, role: OrganizationRole) => {
    const token = `invite_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const invite = await prisma.invite.create({
      data: {
        organizationId: orgId,
        token,
        code: `code_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { token: true },
    });
    return invite.token;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    await prisma.$connect();
  });

  afterAll(async () => {
    // Best-effort cleanup (order matters because of FKs)
    if (createdUserIds.length || createdOrgIds.length) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: AuditEntityType.USER,
          OR: [
            { entityId: { in: createdUserIds } },
            { organizationId: { in: createdOrgIds } },
          ],
        },
      }).catch(() => {});

      await prisma.membership.deleteMany({
        where: { userId: { in: createdUserIds } },
      }).catch(() => {});

      await prisma.student.deleteMany({
        where: { orgId: { in: createdOrgIds } },
      }).catch(() => {});

      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      }).catch(() => {});

      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }

    await prisma.$disconnect();
    await app.close();
  });

  const decodeJwt = (token: string): any => jwtService.decode(token) ?? {};

  it('REGISTER CREATE_ORG – bare user: no org in DB, claims, or audit', async () => {
    const email = baseEmail();
    const payload = {
      name: 'Bare User',
      email,
      password: 'Password123!',
      username: 'indiv_user',
      mode: RegisterMode.CREATE_ORG,
    };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    const body = res.body?.data ?? res.body;

    expect(body.user).toBeTruthy();
    expect(body.user.email).toBe(email);
    expect(body.organization ?? null).toBeNull();
    expect(body.membership ?? null).toBeNull();
    expect(body.sessionToken).toBeTruthy();

    const userId = body.user.id as string;
    createdUserIds.push(userId);

    // DB: user only (no membership/org)
    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);

    const membershipCount = await prisma.membership.count({ where: { userId } });
    expect(membershipCount).toBe(0);

    // No organization that references this user via memberships
    const orgViaMembership = await prisma.organization.findFirst({
      where: {
        memberships: {
          some: { userId },
        },
      },
    });
    expect(orgViaMembership).toBeNull();

    // JWT claims contain no organization context
    const claims = decodeJwt(body.sessionToken);
    expect(claims.organizationId ?? null).toBeNull();
    expect(claims.organizationRole ?? null).toBeNull();

    // Audit log: REGISTER with null organizationId
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'REGISTER',
        entityType: AuditEntityType.USER,
        entityId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(logs.length).toBe(1);
    const log = logs[0]!;
    expect(log.organizationId).toBeNull();
    const meta = (log.metadata ?? {}) as any;
    expect(meta.mode).toBe(RegisterMode.CREATE_ORG);
  });

  it('REGISTER CREATE_ORG – creates User only (onboarding pending, no organizationName)', async () => {
    const email = baseEmail();
    const payload = {
      name: 'Owner User',
      email,
      password: 'Password123!',
      username: 'owner_user',
      mode: RegisterMode.CREATE_ORG,
    };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    const body = res.body?.data ?? res.body;

    expect(body.user).toBeTruthy();
    expect(body.organization ?? null).toBeNull();
    expect(body.membership ?? null).toBeNull();
    expect(body.sessionToken).toBeTruthy();

    const userId = body.user.id as string;
    createdUserIds.push(userId);

    // DB: user only, no organization nor membership yet (onboarding step creates them)
    const [user, membershipCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.membership.count({ where: { userId } }),
    ]);
    expect(user).toBeTruthy();
    expect(membershipCount).toBe(0);

    // JWT: no org context until onboarding completes
    const claims = decodeJwt(body.sessionToken);
    expect(claims.organizationId ?? null).toBeNull();
    expect(claims.organizationRole ?? null).toBeNull();

    // Audit: REGISTER with onboardingState = CREATE_ORG_PENDING
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'REGISTER',
        entityType: AuditEntityType.USER,
        entityId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(logs.length).toBe(1);
    const log = logs[0]!;
    expect(log.organizationId).toBeNull();
    const meta = (log.metadata ?? {}) as any;
    expect(meta.mode).toBe(RegisterMode.CREATE_ORG);
    expect(meta.onboardingState).toBe('CREATE_ORG_PENDING');
  });

  it('REGISTER JOIN_ORG – creates User with membership from invite', async () => {
    const org = await prisma.organization.create({
      data: { name: `Join Org ${Date.now()}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    createdOrgIds.push(org.id);
    const inviteToken = await createInviteForOrg(org.id, OrganizationRole.TEACHER);

    const email = baseEmail();
    const payload = {
      name: 'Join User',
      email,
      password: 'Password123!',
      username: 'join_user',
      mode: RegisterMode.JOIN_ORG,
      inviteToken,
    };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    const body = res.body?.data ?? res.body;

    expect(body.user).toBeTruthy();
    expect(body.organization?.id).toBe(org.id);
    expect(body.membership?.organizationId).toBe(org.id);
    expect(body.membership?.role).toBe(OrganizationRole.TEACHER);
    expect(body.sessionToken).toBeTruthy();

    const userId = body.user.id as string;
    createdUserIds.push(userId);

    const [userCount, membershipCount, orgViaMembership] = await Promise.all([
      prisma.user.count({ where: { email } }),
      prisma.membership.count({ where: { userId } }),
      prisma.organization.findFirst({
        where: { memberships: { some: { userId } } },
      }),
    ]);
    expect(userCount).toBe(1);
    expect(membershipCount).toBe(1);
    expect(orgViaMembership?.id).toBe(org.id);

    // JWT claims should have org context from invite
    const claims = decodeJwt(body.sessionToken);
    expect(claims.organizationId).toBe(org.id);
    expect(claims.organizationRole).toBe(OrganizationRole.TEACHER);

    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'REGISTER',
        entityType: AuditEntityType.USER,
        entityId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(logs.length).toBe(1);
    const log = logs[0]!;
    expect(log.organizationId).toBe(org.id);
    const meta = (log.metadata ?? {}) as any;
    expect(meta.mode).toBe(RegisterMode.JOIN_ORG);
    expect(meta.inviteId).toBeTruthy();
  });

  it('POST /auth/join – legacy join disabled', async () => {
    const school = await prisma.organization.create({
      data: { name: `Join School ${Date.now()}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    createdOrgIds.push(school.id);

    const email = baseEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Joiner',
        email,
        password: 'Password123!',
        username: `joiner_${Date.now()}`,
        mode: RegisterMode.CREATE_ORG,
      })
      .expect(201);

    const registerBody = registerRes.body?.data ?? registerRes.body;
    const userId = registerBody.user.id as string;
    createdUserIds.push(userId);

    await request(app.getHttpServer())
      .post('/auth/join')
      .set('Authorization', `Bearer ${registerBody.sessionToken}`)
      .send({ joinCode: school.id, role: OrganizationRole.STUDENT })
      .expect(410);
  });

  it('LOGIN does not create organization for legacy user without memberships', async () => {
    const email = baseEmail();
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const legacyUser = await prisma.user.create({
      data: {
        email,
        username: `legacy_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: 'Legacy User',
        passwordHash,
      },
      select: { id: true },
    });
    createdUserIds.push(legacyUser.id);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const loginBody = loginRes.body?.data ?? loginRes.body;
    expect(loginBody.organization ?? null).toBeNull();

    const membershipCount = await prisma.membership.count({
      where: { userId: legacyUser.id },
    });
    expect(membershipCount).toBe(0);
  });

  it('REGISTER duplicate email – returns 400 and does not create extra entities', async () => {
    const email = baseEmail();
    const payload = {
      name: 'Duplicate User',
      email,
      password: 'Password123!',
      username: 'dup_user',
      role: OrganizationRole.STUDENT,
      mode: RegisterMode.CREATE_ORG,
    };

    // first registration
    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    const firstBody = first.body?.data ?? first.body;
    const userId = firstBody.user.id as string;
    createdUserIds.push(userId);

    const userCountBefore = await prisma.user.count({ where: { email } });
    const orgCountBefore = await prisma.organization.count();
    const membershipCountBefore = await prisma.membership.count();

    // second registration with same email
    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...payload, username: 'dup_user_2' })
      .expect(400); // controller wraps ConflictException into 400 BadRequest

    expect(second.body).toBeTruthy();

    const userCountAfter = await prisma.user.count({ where: { email } });
    const orgCountAfter = await prisma.organization.count();
    const membershipCountAfter = await prisma.membership.count();

    expect(userCountAfter).toBe(userCountBefore); // stále jen jeden user
    expect(orgCountAfter).toBe(orgCountBefore);
    expect(membershipCountAfter).toBe(membershipCountBefore);
  });

  it('REGISTER missing mode → returns 400', async () => {
    const email = baseEmail();
    const payload = {
      name: 'Legacy FE User',
      email,
      password: 'Password123!',
      username: 'legacy_user',
      // žádný mode → explicitní intent je povinný
    };

    const before = await prisma.user.count({ where: { email } });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(400);

    const after = await prisma.user.count({ where: { email } });
    expect(after).toBe(before);
  });
});
