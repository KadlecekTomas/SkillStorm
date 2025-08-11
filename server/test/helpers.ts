// test/helpers.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

/**
 * Generuje jednoduchý, ale dostatečně unikátní suffix.
 * Bez crypto, funguje v každém Node prostředí.
 */
function unique(prefix: string, seed = 'u') {
  const rnd = Math.floor(Math.random() * 1e9);
  return `${prefix}_${seed}_${Date.now()}_${rnd}`;
}

/**
 * Registrace uživatele pro E2E testy.
 * - Vždy unikátní name/email/username
 * - 3 pokusy (pro případnou kolizi unikátních constraintů)
 */
export async function register(
  app: INestApplication,
  seed = 'u',
  nameOverride?: string,
) {
  for (let i = 0; i < 3; i++) {
    const tag = unique('e2e', seed);
    const payload = {
      name: nameOverride ?? `E2E User ${tag}`,
      email: `${tag}@example.com`,
      username: tag.toLowerCase(),
      password: 'Password123!',
    };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload);

    if (res.status === 201) {
      return {
        user: res.body.user,
        accessToken: res.body.accessToken as string,
        login: { login: payload.email, password: payload.password },
      };
    }

    // malý backoff a zkusíme jiné tagy
    await new Promise((r) => setTimeout(r, 50 + i * 50));
  }
  throw new Error('register() failed after 3 attempts');
}

/**
 * Login helper – vrací access token.
 */
export async function login(
  app: INestApplication,
  creds: { login: string; password: string },
) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send(creds);

  if (res.status !== 201) {
    throw new Error(`login failed: ${res.status}`);
  }
  return res.body.accessToken as string;
}
