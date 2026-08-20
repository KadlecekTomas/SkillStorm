import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loadManifest, storageStateFor, STORAGE_DIR } from './manifest';

/**
 * Auth setup project — runs after the production stack is up, before specs.
 * Sessions are established through the real login API over HTTPS.
 */
setup('authenticate all roles', async ({ baseURL }) => {
  mkdirSync(STORAGE_DIR, { recursive: true });
  const m = loadManifest();

  const roles: Array<[string, string, string | null]> = [
    ['director', m.accounts.director, m.orgId],
    ['teacher', m.accounts.teacher, m.orgId],
    ['student8a', m.accounts.student8a, m.orgId],
    ['student2a', m.accounts.student2a, m.orgId],
    ['studentHs', m.accounts.studentHs, m.orgId],
    ['parent', m.accounts.parent, m.orgId],
    ['superadmin', m.accounts.superadmin, null],
    ['otherOrgStudent', m.accounts.otherOrgStudent, m.foreignOrgId],
  ];

  const randomIp = () =>
    `10.${1 + Math.floor(Math.random() * 254)}.${Math.floor(
      Math.random() * 254,
    )}.${1 + Math.floor(Math.random() * 254)}`;

  const resolvedBaseURL = baseURL ?? 'https://localhost:3443';
  const isCertificationHttps = resolvedBaseURL.startsWith('https://');

  for (let i = 0; i < roles.length; i++) {
    const [role, email, organizationId] = roles[i]!;
    const ctx = await playwrightRequest.newContext({
      baseURL: resolvedBaseURL,
      ignoreHTTPSErrors: isCertificationHttps,
    });
    const res = await ctx.post('/api/auth/login', {
      data: {
        email,
        password: m.password,
        ...(organizationId ? { organizationId } : {}),
      },
      headers: { 'X-Forwarded-For': randomIp() },
    });
    expect(res.ok(), `login for ${role} (${email})`).toBeTruthy();

    const me = await ctx.get('/api/auth/me');
    expect(me.ok(), `me for ${role}`).toBeTruthy();

    const state = await ctx.storageState();
    if (isCertificationHttps) {
      const byName = new Map(state.cookies.map((cookie) => [cookie.name, cookie]));
      const access = byName.get('ss_at');
      const refresh = byName.get('ss_rt');
      const csrf = byName.get('ss_csrf');

      expect(access, `${role} access cookie exists`).toBeDefined();
      expect(refresh, `${role} refresh cookie exists`).toBeDefined();
      expect(csrf, `${role} csrf cookie exists`).toBeDefined();

      expect(access?.secure, `${role} access cookie is Secure`).toBe(true);
      expect(access?.httpOnly, `${role} access cookie is HttpOnly`).toBe(true);
      expect(access?.sameSite, `${role} access cookie SameSite`).toBe('Lax');

      expect(refresh?.secure, `${role} refresh cookie is Secure`).toBe(true);
      expect(refresh?.httpOnly, `${role} refresh cookie is HttpOnly`).toBe(true);
      expect(refresh?.sameSite, `${role} refresh cookie SameSite`).toBe('Lax');

      expect(csrf?.secure, `${role} csrf cookie is Secure`).toBe(true);
      expect(csrf?.httpOnly, `${role} csrf cookie is browser-readable`).toBe(false);
      expect(csrf?.sameSite, `${role} csrf cookie SameSite`).toBe('Lax');
    }

    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.dispose();
  }
});
