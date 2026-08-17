import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loadManifest, storageStateFor, STORAGE_DIR } from './manifest';

/**
 * Auth setup project — runs after the production stack is up, before specs.
 *
 * Sessions are established through the real login API. In HTTPS product
 * certification the edge certificate is signed by an ephemeral CI-only CA;
 * manually created APIRequestContexts therefore opt out of CA-chain checking
 * while still using HTTPS and exercising production Secure cookies normally.
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

  // The backend runs with throttling ON. Give every setup login a fresh
  // deterministic-shape client address so setup itself cannot exhaust a
  // school/shared-IP budget. The HTTPS edge canonicalizes this value before
  // forwarding it through Next to Nest.
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
    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.dispose();
  }
});
