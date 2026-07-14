// test/e2e/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationType, UserStatus } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';
import * as cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { hashToken } from '@/auth/token.util';

function getCookie(res: request.Response, name: string): string | null {
  const setCookie = res.headers?.['set-cookie'];
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const item of list) {
    const match = item.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

function uniqueIp() {
  const rnd = () => Math.floor(Math.random() * 250) + 1;
  return `10.${rnd()}.${rnd()}.${rnd()}`;
}

describe('Auth (e2e) – robust', () => {
  let savedUsername: string;
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: request.SuperAgentTest;

  // test user state
  const unique = Date.now();
  const base = `e2e.${unique}`;
  const regPayload = {
    name: 'E2E Tester',
    email: `${base}@example.com`,
    username: `u_${unique}`,
    password: 'Password123!',
    role: OrganizationRole.STUDENT,
    mode: RegisterMode.CREATE_ORG,
  };

  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    agent = request.agent(app.getHttpServer());

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    // cleanup user tree (best effort)
    if (userId) {
      await prisma.refreshToken
        .deleteMany({ where: { userId } })
        .catch(() => {});
      await prisma.revokedToken
        .deleteMany({ where: { token: accessToken } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  // --------------------------
  // REGISTER
  // --------------------------
  it('POST /auth/register → vytvoří usera a přihlásí (lastLoginAt vyplněné)', async () => {
    const res = await agent
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send(regPayload)
      .expect(201);

    expect(res.body.user.email).toBe(regPayload.email);
    expect(res.body.user.username).toBeTruthy();
    expect(res.body.user.lastLoginAt).toBeTruthy();
    const cookieAccess = getCookie(res, 'ss_at');
    const cookieRefresh = getCookie(res, 'ss_rt');
    expect(cookieAccess).toBeTruthy();
    expect(cookieRefresh).toBeTruthy();

    savedUsername = res.body.user.username;
    accessToken = cookieAccess ?? '';
    refreshToken = cookieRefresh ?? '';
    userId = res.body.user.id;
  });

  it('POST /auth/register → 400 při duplicitním emailu (wrapping Conflict)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ ...regPayload, username: `other_${unique}` })
      .expect(400);
  });

  it('POST /auth/register → 400 invalid body (krátké heslo / chybějící jméno / invalid email)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: '', email: 'not-email', password: 'x' })
      .expect(400);
  });

  it('POST /auth/register → 400 when password too short (< 8)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Test User',
        email: `short-pw-${unique}@example.com`,
        password: 'abc12',
        mode: RegisterMode.CREATE_ORG,
      })
      .expect(400);
  });

  it('POST /auth/register → 400 when password has no number', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Test User',
        email: `no-num-${unique}@example.com`,
        password: 'abcdefgh',
        mode: RegisterMode.CREATE_ORG,
      });
    expect([400, 429]).toContain(res.status);
  });

  it('POST /auth/register → 201 when password meets policy (8+ chars, letter, number)', async () => {
    const email = `valid-pw-${unique}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Valid Password User',
        email,
        password: 'abcd1234',
        mode: RegisterMode.CREATE_ORG,
      });
    expect([201, 429]).toContain(res.status);
    if (res.status !== 201) {
      return;
    }
    expect(res.body.user?.email).toBe(email);
    expect(res.body.sessionToken ?? res.body.data?.sessionToken).toBeTruthy();
  });

  // --------------------------
  // ME (protected)
  // --------------------------
  it('GET /auth/me → vrátí profil se správným emailem', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const me = res.body?.data ?? res.body;
    const meUser = me?.user ?? me;

    expect(meUser.id).toBe(userId);
    expect(meUser.email).toBe(regPayload.email);
    expect(meUser.lastLoginAt).toBeTruthy();
  });

  it('GET /auth/me → 401 bez tokenu', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  // --------------------------
  // LOGIN
  // --------------------------
  it('POST /auth/login → přihlásí (email), aktualizuje lastLoginAt', async () => {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });

    const res = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: regPayload.password })
      .expect(201);

    expect(res.body.sessionToken).toBeTruthy();
    expect(res.body.user.lastLoginAt).toBeTruthy();

    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });

    if (!after?.lastLoginAt || !before?.lastLoginAt) {
      throw new Error('Missing lastLoginAt for comparison');
    }
    expect(new Date(after.lastLoginAt).getTime()).toBeGreaterThan(
      new Date(before.lastLoginAt).getTime(),
    );

    accessToken = res.body.sessionToken;
    refreshToken = getCookie(res, 'ss_rt') ?? '';
  });

  it('POST /auth/login → 400 když request nemá email/password (validace DTO)', async () => {
    await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({})
      .expect(400);
  });

  it('POST /auth/login → 400 když request nemá validní email', async () => {
    await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: savedUsername, password: regPayload.password })
      .expect(400);
  });

  it('POST /auth/login → 401 při špatném hesle', async () => {
    await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: 'totally-wrong' })
      .expect(401);
  });

  it('POST /auth/login → 401 při neexistujícím userovi', async () => {
    await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'nobody@example.com', password: 'Password123!' })
      .expect(401);
  });

  it('POST /auth/login → 401 pro suspended účet', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: regPayload.password })
      .expect(401);

    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  });

  it('POST /auth/login → without organizationId with 2 memberships uses deterministic org (oldest by createdAt)', async () => {
    const bcrypt = await import('bcryptjs');
    const pw = 'TwoOrgUser123!';
    const email = `twoorg_${Date.now()}@example.com`;
    const u = await prisma.user.create({
      data: {
        email,
        username: `twoorg_${Date.now()}`,
        name: 'Two Org User',
        passwordHash: await bcrypt.hash(pw, 10),
      },
      select: { id: true },
    });
    const org1 = await prisma.organization.create({
      data: { name: `TwoOrg A ${Date.now()}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    const org2 = await prisma.organization.create({
      data: { name: `TwoOrg B ${Date.now()}`, type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    const m1 = await prisma.membership.create({
      data: { userId: u.id, organizationId: org1.id, role: OrganizationRole.DIRECTOR },
      select: { id: true, organizationId: true },
    });
    await prisma.membership.create({
      data: { userId: u.id, organizationId: org2.id, role: OrganizationRole.DIRECTOR },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password: pw })
      .expect(201);
    const token = loginRes.body.sessionToken ?? loginRes.body.data?.sessionToken;
    expect(token).toBeTruthy();
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const me = meRes.body?.data ?? meRes.body;
    expect(me?.organization?.id).toBe(m1.organizationId);
    await prisma.membership.deleteMany({ where: { userId: u.id } });
    await prisma.organization.deleteMany({ where: { id: { in: [org1.id, org2.id] } } });
    await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  });

  // --------------------------
  // REFRESH (rotation + reuse block)
  // --------------------------
  it('POST /auth/refresh → protočí refresh, starý zmizí (rotation)', async () => {
    const oldToken = refreshToken;
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', [`ss_rt=${refreshToken}`])
      .expect(200);
    expect(res.body.refreshed).toBe(true);

    // starý refresh token musí být smazán
    const old = await prisma.refreshToken.findUnique({
      where: { token: hashToken(oldToken) },
    });
    expect(old?.revokedAt).toBeTruthy();

    refreshToken = getCookie(res, 'ss_rt') ?? '';
  });

  it('POST /auth/refresh → 401 při neplatném/expir. refreshi', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', ['ss_rt=invalid-token'])
      .expect(401);
  });

  it('POST /auth/refresh → reuse detection (pokus o použití již protočeného tokenu) → 401', async () => {
    // vyrobíme nový platný a hned protočíme
    const rotatedOld = refreshToken;
    const first = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', [`ss_rt=${refreshToken}`])
      .expect(200);
    expect(first.body.refreshed).toBe(true);
    refreshToken = getCookie(first, 'ss_rt') ?? '';

    // pokus o opětovné použití starého
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', [`ss_rt=${rotatedOld}`])
      .expect(401);
  });

  // --------------------------
  // LOGOUT (blacklist access + kill refresh)
  // --------------------------
  it('POST /auth/logout → blacklistne access + smaže konkrétní refresh', async () => {
    // nejdřív si vygenerujeme „čerstvé“ tokeny
    const relog = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: regPayload.password })
      .expect(201);
    const tmpAccess = relog.body.sessionToken;
    const tmpRefresh = getCookie(relog, 'ss_rt') ?? '';

    // logout
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${tmpAccess}`)
      .set('Cookie', [`ss_rt=${tmpRefresh}`])
      .expect(201);

    // refresh token je pryč
    const stillThere = await prisma.refreshToken.findUnique({
      where: { token: hashToken(tmpRefresh) },
    });
    expect(stillThere?.revokedAt).toBeTruthy();

    // volání protected endpointu s blacklistnutým access tokenem by mělo selhat (pokud to kontroluješ v guardu/strategy)
    // Jestli blacklist kontroluješ jinde, můžeš tenhle test upravit/odstranit.
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tmpAccess}`)
      .expect(401);

    const msg = String(me.body.message ?? '');
    expect(
      ['Unauthorized', 'Token has been revoked'].some((s) => msg.includes(s)),
    ).toBe(true);
  });

  // --------------------------
  // BEZPEČNOST / okraje
  // --------------------------
  it('POST /auth/refresh → 400 když chybí refreshToken', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh');
    expect([400, 401]).toContain(res.status);
  });

  it('Authorization: Bearer garbage → 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer totally-not-a-jwt`)
      .expect(401);
  });

  // --------------------------
  // AUTH HARDENING: session invalidation after password change
  // --------------------------
  it('after change-password, old JWT cannot access protected route (401)', async () => {
    const oldAccess = accessToken;
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${oldAccess}`)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        currentPassword: regPayload.password,
        newPassword: 'NewPassword123!',
      })
      .expect(201);

    // Old token must be rejected (invalidated by password change)
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${oldAccess}`)
      .expect(401);

    // Restore login with new password for subsequent tests
    const relog = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: 'NewPassword123!' })
      .expect(201);
    accessToken = relog.body.sessionToken ?? '';
    refreshToken = getCookie(relog, 'ss_rt') ?? '';
  });

  it('GET /auth/me → 401 when suspended user presents previously valid JWT', async () => {
    const relog = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: 'NewPassword123!' })
      .expect(201);
    const token = relog.body.sessionToken;
    expect(token).toBeTruthy();

    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  });

  it('GET /auth/me → 401 when user is soft-deleted', async () => {
    const relog = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: regPayload.email, password: 'NewPassword123!' })
      .expect(201);
    const token = relog.body.sessionToken;
    expect(token).toBeTruthy();

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  });

  // --------------------------
  // AUTH HARDENING: reset token single-use, second use returns generic failure
  // --------------------------
  it('reset-password token works once, second use returns generic failure (no leak)', async () => {
    const crypto = await import('crypto');
    const dateFns = await import('date-fns');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = dateFns.addHours(new Date(), 1);
    await prisma.passwordResetToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: rawToken, newPassword: 'AnotherPass123!' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: rawToken, newPassword: 'YetAnother123!' })
      .expect(400);

    expect(res.body.message).toBe('Operace se nezdařila.');
  });

  // --------------------------
  // AUTH HARDENING: rate limiting returns 429 with generic message
  // --------------------------
  // The e2e environment runs with DISABLE_THROTTLE=1 (ThrottlerGuard skipIf),
  // otherwise suites sharing one IP trip the hard login/register limits.
  // Rate limiting itself is verified against a production-configured
  // instance (see docs/ops/production-readiness.md).
  const itUnlessThrottleDisabled =
    process.env.DISABLE_THROTTLE === '1' ? it.skip : it;
  itUnlessThrottleDisabled('exceeding login rate limit returns 429 with generic message', async () => {
    const rateLimitIp = '192.168.100.99';
    const body = { email: 'nonexistent@example.com', password: 'wrong' };
    // Exhaust login throttle (10 per 15 min per IP) until we get 429
    let res: request.Response | null = null;
    for (let i = 0; i < 15; i++) {
      res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', rateLimitIp)
        .send(body);
      if (res.status === 429) break;
    }
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.body.message).toBe('Operace se nezdařila.');
  });
});
