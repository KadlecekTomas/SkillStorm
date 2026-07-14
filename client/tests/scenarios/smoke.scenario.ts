import { test, expect } from './fixtures';

/**
 * Infra smoke — validates BLOK 0 end to end: seed manifest, per-role
 * storageState, real backend. Not a product scenario; keeps the plumbing
 * honest so product specs fail for product reasons only.
 */
test('seed manifest is present and coherent', async ({ manifest }) => {
  expect(manifest.students8A).toHaveLength(30);
  expect(manifest.students2A).toHaveLength(5);
  expect(manifest.accounts.teacher).toContain('@scenar.test');
  expect(manifest.foreignAssignmentId).toBeTruthy();
});

test('each role storageState yields an authenticated session', async ({ asRole }) => {
  for (const role of ['director', 'teacher', 'student8a', 'student2a'] as const) {
    const { page } = await asRole(role);
    const me = await page.request.get('/api/auth/me');
    expect(me.ok(), `${role} should be authenticated`).toBeTruthy();
    const body = await me.json();
    const user = body.data?.user ?? body.user;
    expect(user?.email).toContain('@scenar.test');
  }
});
