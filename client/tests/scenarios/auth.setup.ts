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

  const roles: Array<[string, string]> = [
    ['director', m.accounts.director],
    ['teacher', m.accounts.teacher],
    ['student8a', m.accounts.student8a],
    ['student2a', m.accounts.student2a],
    ['otherOrgStudent', m.accounts.otherOrgStudent],
  ];

  for (const [role, email] of roles) {
    const ctx = await playwrightRequest.newContext({ baseURL });
    const res = await ctx.post('/api/auth/login', {
      data: { email, password: m.password },
    });
    expect(res.ok(), `login for ${role} (${email})`).toBeTruthy();
    // /api/auth/me confirms the cookie session is live before we persist it
    const me = await ctx.get('/api/auth/me');
    expect(me.ok(), `me for ${role}`).toBeTruthy();
    await ctx.storageState({ path: storageStateFor(role) });
    await ctx.dispose();
  }
});
