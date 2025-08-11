// test/e2e/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';

describe('Auth (e2e) – robust', () => {
  let savedUsername: string;
  let app: INestApplication;
  let prisma: PrismaService;

  // test user state
  const unique = Date.now();
  const base = `e2e.${unique}`;
  const regPayload = {
    name: 'E2E Tester',
    email: `${base}@example.com`,
    username: `u_${unique}`,
    password: 'Password123!',
  };

  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

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
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(regPayload)
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe(regPayload.email);
    expect(res.body.user.username).toBeTruthy();
    expect(res.body.user.lastLoginAt).toBeTruthy();

    savedUsername = res.body.user.username;
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    userId = res.body.user.id;
  });

  it('POST /auth/register → 409 při duplicitním emailu', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...regPayload, username: `other_${unique}` })
      .expect(409);
  });

  it('POST /auth/register → 400 invalid body (krátké heslo / chybějící jméno / invalid email)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
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
  it('POST /auth/login → přihlásí (email jako login), aktualizuje lastLoginAt', async () => {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: regPayload.email, password: regPayload.password })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.lastLoginAt).toBeTruthy();

    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });

    expect(new Date(after!.lastLoginAt).getTime()).toBeGreaterThan(
      new Date(before!.lastLoginAt).getTime(),
    );

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/login → přihlásí i přes username', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: savedUsername, password: regPayload.password })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('POST /auth/login → 401 při špatném hesle', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: regPayload.email, password: 'totally-wrong' })
      .expect(401);
  });

  it('POST /auth/login → 401 při neexistujícím userovi', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'nobody@example.com', password: 'Password123!' })
      .expect(401);
  });

  // --------------------------
  // REFRESH (rotation + reuse block)
  // --------------------------
  it('POST /auth/refresh → protočí refresh, starý zmizí (rotation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    // starý refresh token musí být smazán
    const old = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    expect(old).toBeNull();

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /auth/refresh → 401 při neplatném/expir. refreshi', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);
  });

  it('POST /auth/refresh → reuse detection (pokus o použití již protočeného tokenu) → 401', async () => {
    // vyrobíme nový platný a hned protočíme
    const first = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    const rotatedOld = refreshToken; // právě byl smazán
    accessToken = first.body.accessToken;
    refreshToken = first.body.refreshToken;

    // pokus o opětovné použití starého
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotatedOld })
      .expect(401);
  });

  // --------------------------
  // LOGOUT (blacklist access + kill refresh)
  // --------------------------
  it('POST /auth/logout → blacklistne access + smaže konkrétní refresh', async () => {
    // nejdřív si vygenerujeme „čerstvé“ tokeny
    const relog = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: regPayload.email, password: regPayload.password })
      .expect(201);
    const tmpAccess = relog.body.accessToken;
    const tmpRefresh = relog.body.refreshToken;

    // logout
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${tmpAccess}`)
      .send({ refreshToken: tmpRefresh })
      .expect(201);

    // refresh token je pryč
    const stillThere = await prisma.refreshToken.findUnique({
      where: { token: tmpRefresh },
    });
    expect(stillThere).toBeNull();

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
  it('POST /auth/login → 400 když request nemá login/password (forbidNonWhitelisted OFF, ale validace ON)', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('POST /auth/refresh → 400 když chybí refreshToken', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });

  it('Authorization: Bearer garbage → 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer totally-not-a-jwt`)
      .expect(401);
  });
});
