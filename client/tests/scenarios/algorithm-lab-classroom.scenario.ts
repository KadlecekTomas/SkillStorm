import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const SESSION_ID = '12111111-1111-4111-8111-111111111111';
const STAGE_ID = '23222222-2222-4222-8222-222222222222';
const ACTIVITY_VERSION_ID = '34333333-3333-4333-8333-333333333333';

function studentProjection(status: 'RUNNING' | 'PAUSED' = 'RUNNING') {
  return {
    id: SESSION_ID,
    status,
    mode: 'DEVICES',
    stateRevision: status === 'RUNNING' ? 1 : 2,
    startedAt: '2026-08-09T18:00:00.000Z',
    pausedAt: status === 'PAUSED' ? '2026-08-09T18:05:00.000Z' : null,
    finishedAt: null,
    participant: {
      id: '45444444-4444-4444-8444-444444444444',
      groupId: null,
      status: 'CONNECTED',
      lastSeenAt: '2026-08-09T18:00:00.000Z',
    },
    currentStage: {
      id: STAGE_ID,
      stageKey: 'ALGORITHM_LAB',
      orderIndex: 0,
      stageType: 'PROGRAM',
      title: 'Robot Rescue',
      activityVersionId: ACTIVITY_VERSION_ID,
      completionType: 'CHECKPOINT',
      checkpoint: true,
    },
  };
}

test.describe('Algorithm Lab classroom player', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('emits algorithm semantics and obeys teacher pause without raw telemetry', async ({ page }) => {
    let status: 'RUNNING' | 'PAUSED' = 'RUNNING';
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
        body: JSON.stringify(studentProjection(status)),
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
          evidence:
            body.eventType === 'CHECKPOINT_COMPLETED'
              ? { id: `evidence-${semanticBodies.length}`, evidenceType: body.eventType }
              : null,
        }),
      });
    });

    await page.goto(`/app/labs/algorithm-lab?session=${SESSION_ID}`);
    await expect(page.getByTestId('algorithm-classroom-session-label')).toContainText('Robot Rescue');
    await expect(page.getByTestId('algorithm-classroom-blocking-overlay')).toHaveCount(0);

    await page.getByRole('button', { name: '↑ Krok' }).click();
    await page.getByRole('button', { name: '↑ Krok' }).click();
    await page.getByRole('button', { name: '↷ Vpravo' }).click();
    await page.getByRole('button', { name: '↑ Krok' }).click();
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();

    await expect(page.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.', {
      timeout: 8_000,
    });
    await expect(page.getByTestId('algorithm-server-event-count')).toHaveText('6', {
      timeout: 5_000,
    });

    expect(semanticBodies.map((body) => body.eventType)).toEqual([
      'ALGORITHM_STEP_ADDED',
      'ALGORITHM_STEP_ADDED',
      'ALGORITHM_STEP_ADDED',
      'ALGORITHM_STEP_ADDED',
      'PROGRAM_RUN',
      'CHECKPOINT_COMPLETED',
    ]);

    for (const body of semanticBodies) {
      expect(body.stageId).toBe(STAGE_ID);
      const payload = body.payload as Record<string, unknown>;
      expect(Object.keys(payload).some((key) => /pointer|cursor|mouse|coordinate/i.test(key))).toBe(false);
    }

    const checkpoint = semanticBodies.at(-1)?.payload as Record<string, unknown>;
    expect(checkpoint.checkpoint).toBe('ALGORITHM_MISSION_1');
    expect(checkpoint.completionIsMastery).toBe(false);
    expect(checkpoint.finalPosition).toEqual({ x: 2, y: 1 });

    await page.screenshot({
      path: 'test-results/algorithm-lab-08-classroom-live.png',
      fullPage: true,
    });

    status = 'PAUSED';
    await expect(page.getByTestId('algorithm-classroom-blocking-overlay')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('algorithm-classroom-session-label')).toContainText('pozastavena');

    await page.screenshot({
      path: 'test-results/algorithm-lab-09-classroom-paused.png',
      fullPage: true,
    });
  });
});
