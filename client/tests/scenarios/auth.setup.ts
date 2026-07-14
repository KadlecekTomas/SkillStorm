import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loadManifest, storageStateFor, STORAGE_DIR } from './manifest';

/**
 * Auth setup project — runs after webServer is up, before the scenario specs.
 *
 * Sessions are established via the login API (auth is cookie-based) rather
 * than the UI: this is deterministic and immune to first-hit dev-server
 * compile latency. The resulting httpOnly cookies are saved as storageState
 * so every spec starts already authenticated. (The login FORM itself is
 * still exercised directly by the security block's session-expiry and
 * rate-limit specs.)
 */
setup('authenticate all roles', async ({ baseURL }) => {
  mkdirSync(STORAGE_DIR, { recursive: true });
  const m = loadManifest();

  // [role, email, orgId] — passing organizationId scopes the JWT to that org
  // (a plain single-org login does NOT put organizationRole in the token, so
  // role-gated pages would 403). scenar.* users belong to orgId; the other-org
  // student belongs to foreignOrgId.
  const roles: Array<[string, string, string]> = [
    ['director', m.accounts.director, m.orgId],
    ['teacher', m.accounts.teacher, m.orgId],
    ['student8a', m.accounts.student8a, m.orgId],
    ['student2a', m.accounts.student2a, m.orgId],
    ['studentHs', m.accounts.studentHs, m.orgId],
    ['otherOrgStudent', m.accounts.otherOrgStudent, m.foreignOrgId],
  ];

  for (let i = 0; i < roles.length; i++) {
    const [role, email, organizationId] = roles[i]!;
    const ctx = await playwrightRequest.newContext({
      baseURL: baseURL ?? 'http://127.0.0.1:3001',
    });
    // The backend runs with throttling ON (the rate-limit block needs it).
    // Give each role login a distinct client IP (TRUST_PROXY=1 honours
    // X-Forwarded-For) so setup never shares a rate-limit bucket and stays
    // reliable across reruns.
    const res = await ctx.post('/api/auth/login', {
      data: { email, password: m.password, organizationId },
      headers: { 'X-Forwarded-For': `10.90.0.${i + 1}` },
    });
    expect(res.ok(), `login for ${role} (${email})`).toBeTruthy();
    // /api/auth/me confirms the cookie session is live before we persist it
    const me = await ctx.get('/api/auth/me');
    expect(me.ok(), `me for ${role}`).toBeTruthy();
    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.dispose();
  }
});
