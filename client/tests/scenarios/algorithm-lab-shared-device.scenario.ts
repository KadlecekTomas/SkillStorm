import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const SESSION_ID = '13111111-1111-4111-8111-111111111111';
const STAGE_ID = '24222222-2222-4222-8222-222222222222';
const ACTIVITY_VERSION_ID = '35333333-3333-4333-8333-333333333333';

function sharedProjection() {
  return {
    id: SESSION_ID,
    status: 'RUNNING',
    mode: 'SHARED_DEVICES',
    stateRevision: 1,
    startedAt: '2026-08-09T18:30:00.000Z',
    pausedAt: null,
    finishedAt: null,
    participant: {
      id: '46444444-4444-4444-8444-444444444444',
      groupId: '57555555-5555-4555-8555-555555555555',
      status: 'CONNECTED',
      lastSeenAt: '2026-08-09T18:30:00.000Z',
    },
    currentStage: {
      id: STAGE_ID,
      stageKey: 'ALGORITHM_LAB_COOP',
      orderIndex: 0,
      stageType: 'PROGRAM',
      title: 'Robot Rescue · dvojice',
      activityVersionId: ACTIVITY_VERSION_ID,
      completionType: 'CHECKPOINT',
      checkpoint: true,
    },
  };
}

test.describe('Algorithm Lab shared-device cooperation', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('enforces Planner → Programmer handoff and rotates back after a failed run', async ({ page }) => {
    const semanticBodies: Array<Record<string, unknown>> = [];

    await page.route(`**/api/classroom-sessions/${SESSION_ID}/join`, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'participant' }),
      });
    });

    await page.route(`**/api/classroom-sessions/${SESSION_ID}/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sharedProjection()),
      });
    });

    await page.route(`**/api/classroom-sessions/${SESSION_ID}/events`, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      semanticBodies.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          replayed: false,
          event: {
            id: `event-${semanticBodies.length}`,
            eventId: body.eventId,
            eventType: body.eventType,
          },
          evidence: null,
        }),
      });
    });

    await page.goto(`/app/labs/algorithm-lab?session=${SESSION_ID}`);

    await expect(page.getByTestId('algorithm-coop-banner')).toBeVisible();
    await expect(page.getByTestId('algorithm-coop-role')).toHaveText('Planner plánuje');

    // Planner can inspect the mission but cannot manipulate the program.
    await page.getByRole('button', { name: '↑ Krok' }).click();
    await expect(page.getByTestId('algorithm-program')).toContainText('Přidej první příkaz');
    expect(semanticBodies).toHaveLength(0);

    await page.getByTestId('algorithm-coop-handoff').click();
    await expect(page.getByTestId('algorithm-coop-role')).toHaveText('Programmer ovládá zařízení');

    // Programmer deliberately runs an incomplete solution.
    await page.getByRole('button', { name: '↑ Krok' }).click();
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();

    await expect(page.getByTestId('algorithm-result')).toContainText('Tahle verze ještě nefunguje.', {
      timeout: 8_000,
    });
    await expect(page.getByTestId('algorithm-coop-role')).toHaveText('Planner plánuje', {
      timeout: 5_000,
    });

    expect(semanticBodies.map((body) => body.eventType)).toEqual([
      'ALGORITHM_STEP_ADDED',
      'PROGRAM_RUN',
      'TEST_FAILED',
    ]);
    const runPayload = semanticBodies[1]?.payload as Record<string, unknown>;
    expect(runPayload.collaborationRole).toBe('PROGRAMMER');
    expect(runPayload.deliveryMode).toBeUndefined();

    await page.screenshot({
      path: 'test-results/algorithm-lab-10-shared-device-rotation.png',
      fullPage: true,
    });
  });
});
