/**
 * BLOK 5 — brute-force protection on auth endpoints.
 *
 * The e2e environment disables throttling globally (DISABLE_THROTTLE=1 in
 * jest-env) so suites can hammer the API. The ThrottlerModule reads that
 * toggle lazily (skipIf closure per request), so this suite re-enables
 * throttling for its own app instance and verifies the route-level limits:
 *   - POST /auth/login: 10 / 900 s per IP → 11th attempt is 429
 *   - POST /auth/register: 3 / 60 s per IP → 4th attempt is 429
 */
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;
  let originalDisableThrottle: string | undefined;

  beforeAll(async () => {
    originalDisableThrottle = process.env.DISABLE_THROTTLE;
    process.env.DISABLE_THROTTLE = '0';

    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Throttler keys on req.ip; trust the X-Forwarded-For header so each
    // test can isolate itself on a unique synthetic IP.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  afterAll(async () => {
    if (originalDisableThrottle === undefined) {
      delete process.env.DISABLE_THROTTLE;
    } else {
      process.env.DISABLE_THROTTLE = originalDisableThrottle;
    }
    await app.close();
  });

  it('POST /auth/login → 429 after 10 attempts from one IP', async () => {
    const ip = '203.0.113.10';
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'bruteforce@example.com', password: 'WrongPass123!' });
      statuses.push(res.status);
    }
    // first 10 fail with 401 (bad credentials), the 11th is throttled
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('POST /auth/register → 429 after 3 attempts from one IP', async () => {
    const ip = '203.0.113.11';
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('X-Forwarded-For', ip)
        .send({
          name: `Throttle Probe ${i}`,
          email: `throttle_probe_${Date.now()}_${i}@example.com`,
          password: 'Password123!',
          mode: 'CREATE_ORG',
        });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s === 201)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it('another IP is unaffected by a throttled neighbour', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '203.0.113.12')
      .send({ email: 'bruteforce@example.com', password: 'WrongPass123!' });
    expect(res.status).toBe(401);
  });
});
