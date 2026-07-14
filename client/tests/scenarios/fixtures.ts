import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loadManifest, storageStateFor, type ScenarioManifest } from './manifest';

/**
 * Shared fixtures for the scenario suite.
 *
 * - `manifest`: seeded accounts + ids.
 * - `asRole(role)`: opens a fresh context already authenticated as that role
 *   via the storageState saved in auth.setup — no re-login per test.
 * - `loginPage(email)`: a raw login (for session-expiry / rate-limit specs
 *   that must exercise the login form itself).
 */
type Fixtures = {
  manifest: ScenarioManifest;
  asRole: (role: RoleKey) => Promise<{ context: BrowserContext; page: Page }>;
};

export type RoleKey =
  | 'director'
  | 'teacher'
  | 'student8a'
  | 'student2a'
  | 'studentHs'
  | 'otherOrgStudent';

export const test = base.extend<Fixtures>({
  manifest: async ({}, use) => {
    await use(loadManifest());
  },
  asRole: async ({ browser }, use) => {
    const opened: BrowserContext[] = [];
    let ipSeq = 0;
    const factory = async (role: RoleKey) => {
      // Backend throttling is ON (the rate-limit block needs it). Give every
      // functional context a distinct client IP (TRUST_PROXY=1 honours
      // X-Forwarded-For) so heavy flows never share a rate-limit bucket.
      ipSeq += 1;
      const context = await browser.newContext({
        storageState: storageStateFor(role),
        extraHTTPHeaders: { 'X-Forwarded-For': `10.80.${ipSeq}.1` },
      });
      opened.push(context);
      const page = await context.newPage();
      return { context, page };
    };
    await use(factory);
    for (const c of opened) await c.close();
  },
});

export { expect };

/** Perform a real UI login on the given (unauthenticated) page. */
export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'commit' });
  await page.getByPlaceholder(/you@school\.edu/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(password);
  await page.getByRole('button', { name: /sign in|přihlásit/i }).click();
}

/** Open the student's first active assignment in Focus Test Mode. */
export async function openActiveAssignment(page: Page): Promise<string> {
  const res = await page.request.get('/api/assignments/overview');
  expect(res.ok(), 'assignments/overview should load').toBeTruthy();
  const body = await res.json();
  const active = (body.data ?? body)?.active ?? [];
  expect(active.length, 'student has an active assignment').toBeGreaterThan(0);
  const id = active[0].assignmentId as string;
  await page.goto(`/app/assignments/${id}/test`, { waitUntil: 'commit' });
  return id;
}
