// test/e2e/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';
import * as cookieParser from 'cookie-parser';

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
    mode: RegisterMode.INDIVIDUAL,
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

  // --------------------------
  // ME (protected)
  // --------------------------
  it('GET /auth/me → vrátí profil se správným emailem', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(regPayload.email);
    expect(res.body.lastLoginAt).toBeTruthy();
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
      where: { token: oldToken },
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
      where: { token: tmpRefresh },
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
    await request(app.getHttpServer()).post('/auth/refresh').expect(400);
  });

  it('Authorization: Bearer garbage → 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer totally-not-a-jwt`)
      .expect(401);
  });
});
