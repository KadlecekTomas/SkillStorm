import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const STAGE_ID = '22222222-2222-4222-8222-222222222222';

test.describe('Build a PC Mission Control analytics', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('shows class progress, intervention count and top misconception', async ({ page }) => {
    await page.route(`**/api/classroom-sessions/${SESSION_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: SESSION_ID,
          sourceKind: 'LESSON_EXPERIENCE',
          status: 'RUNNING',
          mode: 'DEVICES',
          stateRevision: 1,
          classSectionId: '55555555-5555-4555-8555-555555555555',
          startedAt: '2026-08-09T12:00:00.000Z',
          pausedAt: null,
          finishedAt: null,
          currentLessonStageId: STAGE_ID,
          lesson: {
            id: '66666666-6666-4666-8666-666666666666',
            title: 'Build a PC · První boot',
            versionId: '77777777-7777-4777-8777-777777777777',
            versionNo: 1,
            stages: [{
              id: STAGE_ID,
              stageKey: 'BUILD_PC',
              orderIndex: 0,
              stageType: 'EXPLORATION',
              title: 'Sestav pracovní stanici',
              activityVersionId: '33333333-3333-4333-8333-333333333333',
              completionType: 'CHECKPOINT',
              checkpoint: true,
            }],
          },
          groups: [],
          participants: [
            {
              id: 'p1',
              nickname: 'Adam',
              membershipId: 'm1',
              groupId: null,
              status: 'CONNECTED',
              joinedAt: '2026-08-09T12:00:00.000Z',
              lastSeenAt: '2026-08-09T12:00:10.000Z',
              disconnectedAt: null,
            },
            {
              id: 'p2',
              nickname: 'Bára',
              membershipId: 'm2',
              groupId: null,
              status: 'CONNECTED',
              joinedAt: '2026-08-09T12:00:00.000Z',
              lastSeenAt: '2026-08-09T12:00:10.000Z',
              disconnectedAt: null,
            },
          ],
          participantSummary: { total: 2, connected: 2, disconnected: 0 },
        }),
      });
    });

    await page.route(`**/api/classroom-sessions/${SESSION_ID}/build-pc-analytics`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: SESSION_ID,
          generatedAt: '2026-08-09T12:05:00.000Z',
          classSummary: {
            total: 2,
            connected: 2,
            completed: 0,
            needsAttention: 1,
            averageProgressPct: 44,
            totalHints: 2,
            totalRejectedPlacements: 3,
          },
          topMisconception: {
            key: 'ram:gpu-slot',
            label: 'RAM → PCIe slot',
            count: 3,
            participantCount: 2,
          },
          misconceptionClusters: [{
            key: 'ram:gpu-slot',
            label: 'RAM → PCIe slot',
            componentId: 'ram',
            slotId: 'gpu-slot',
            count: 3,
            participantCount: 2,
          }],
          participants: [
            {
              participantId: 'p1',
              nickname: 'Adam',
              status: 'CONNECTED',
              installedCount: 2,
              totalComponents: 8,
              progressPct: 25,
              hintCount: 2,
              rejectedPlacements: 2,
              lastCheckpoint: 'cpu',
              lastEventAt: '2026-08-09T12:04:00.000Z',
              completed: false,
              stalled: false,
              needsAttention: true,
            },
            {
              participantId: 'p2',
              nickname: 'Bára',
              status: 'CONNECTED',
              installedCount: 5,
              totalComponents: 8,
              progressPct: 63,
              hintCount: 0,
              rejectedPlacements: 1,
              lastCheckpoint: 'gpu',
              lastEventAt: '2026-08-09T12:04:30.000Z',
              completed: false,
              stalled: false,
              needsAttention: false,
            },
          ],
        }),
      });
    });

    await page.goto(`/app/labs/build-a-pc/mission-control?session=${SESSION_ID}`);

    await expect(page.getByTestId('mission-analytics-dock')).toBeVisible();
    await expect(page.getByTestId('mission-class-progress')).toHaveText('44%');
    await expect(page.getByTestId('mission-needs-attention')).toHaveText('1');
    await expect(page.getByTestId('mission-top-misconception')).toContainText('RAM → PCIe slot');
    await expect(page.getByTestId('mission-top-misconception')).toContainText('2 žáků');

    await page.screenshot({ path: 'test-results/build-a-pc-mission-analytics.png', fullPage: true });
  });
});
