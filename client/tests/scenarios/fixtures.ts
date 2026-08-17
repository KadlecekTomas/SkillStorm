import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loadManifest, storageStateFor, type ScenarioManifest } from './manifest';

/**
 * Shared fixtures for the scenario suite.
 *
 * - `manifest`: seeded accounts + ids.
 * - `asRole(role)`: opens a fresh context already authenticated as that role.
 *
 * HTTPS certification uses an ephemeral CI CA. Contexts created manually from
 * the raw browser fixture must opt into ignoring that CA trust error themselves;
 * project-level `use.ignoreHTTPSErrors` is not relied on for these contexts.
 */
type Fixtures = {
  manifest: ScenarioManifest;
  asRole: (role: RoleKey) => Promise<{ context: BrowserContext; page: Page }>;
};

function randomClientIp(): string {
  return `10.${1 + Math.floor(Math.random() * 254)}.${Math.floor(
    Math.random() * 254,
  )}.${1 + Math.floor(Math.random() * 254)}`;
}

export type RoleKey =
  | 'director'
  | 'teacher'
  | 'student8a'
  | 'student2a'
  | 'studentHs'
  | 'parent'
  | 'superadmin'
  | 'otherOrgStudent';

export const test = base.extend<Fixtures>({
  manifest: async ({}, use) => {
    await use(loadManifest());
  },
  asRole: async ({ browser, baseURL }, use) => {
    const opened: BrowserContext[] = [];
    const factory = async (role: RoleKey) => {
      const context = await browser.newContext({
        storageState: storageStateFor(role),
        extraHTTPHeaders: { 'X-Forwarded-For': randomClientIp() },
        ignoreHTTPSErrors: Boolean(baseURL?.startsWith('https://')),
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

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'commit' });
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/heslo/i).fill(password);
  await page.getByRole('button', { name: /sign in|přihlásit/i }).click();
}

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
