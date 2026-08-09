import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const STAGE_ID = '22222222-2222-4222-8222-222222222222';
const ACTIVITY_VERSION_ID = '33333333-3333-4333-8333-333333333333';

function studentProjection(status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'FINISHED' = 'RUNNING') {
  return {
    id: SESSION_ID,
    status,
    mode: 'DEVICES',
    stateRevision: status === 'DRAFT' ? 0 : status === 'RUNNING' ? 1 : 2,
    startedAt: status === 'DRAFT' ? null : '2026-08-09T12:00:00.000Z',
    pausedAt: status === 'PAUSED' ? '2026-08-09T12:05:00.000Z' : null,
    finishedAt: status === 'FINISHED' ? '2026-08-09T12:10:00.000Z' : null,
    participant: {
      id: '44444444-4444-4444-8444-444444444444',
      groupId: null,
      status: 'CONNECTED',
      lastSeenAt: '2026-08-09T12:00:00.000Z',
    },
    currentStage: {
      id: STAGE_ID,
      stageKey: 'BUILD_PC',
      orderIndex: 2,
      stageType: 'EXPLORATION',
      title: 'Sestav pracovní stanici',
      activityVersionId: ACTIVITY_VERSION_ID,
      completionType: 'CHECKPOINT',
      checkpoint: true,
    },
  };
}

function teacherProjection(
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'FINISHED',
  stateRevision: number,
) {
  return {
    id: SESSION_ID,
    sourceKind: 'LESSON_EXPERIENCE',
    status,
    mode: 'DEVICES',
    stateRevision,
    classSectionId: '55555555-5555-4555-8555-555555555555',
    startedAt: status === 'DRAFT' ? null : '2026-08-09T12:00:00.000Z',
    pausedAt: status === 'PAUSED' ? '2026-08-09T12:05:00.000Z' : null,
    finishedAt: status === 'FINISHED' ? '2026-08-09T12:10:00.000Z' : null,
    currentLessonStageId: status === 'DRAFT' ? null : STAGE_ID,
    lesson: {
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Build a PC · První boot',
      versionId: '77777777-7777-4777-8777-777777777777',
      versionNo: 1,
      stages: [
        {
          id: STAGE_ID,
          stageKey: 'BUILD_PC',
          orderIndex: 0,
          stageType: 'EXPLORATION',
          title: 'Sestav pracovní stanici',
          activityVersionId: ACTIVITY_VERSION_ID,
          completionType: 'CHECKPOINT',
          checkpoint: true,
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          stageKey: 'EVIDENCE',
          orderIndex: 1,
          stageType: 'EVIDENCE',
          title: 'Vysvětli proč sestava naběhla',
          activityVersionId: null,
          completionType: 'SUBMISSION',
          checkpoint: true,
        },
      ],
    },
    groups: [],
    participants: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        nickname: 'Žák 8.A',
        membershipId: '99999999-9999-4999-8999-999999999999',
        groupId: null,
        status: 'CONNECTED',
        joinedAt: '2026-08-09T12:00:00.000Z',
        lastSeenAt: '2026-08-09T12:00:10.000Z',
        disconnectedAt: null,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        nickname: 'Žák bez signálu',
        membershipId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        groupId: null,
        status: 'DISCONNECTED',
        joinedAt: '2026-08-09T12:00:00.000Z',
        lastSeenAt: '2026-08-09T12:00:03.000Z',
        disconnectedAt: '2026-08-09T12:00:04.000Z',
      },
    ],
    participantSummary: { total: 2, connected: 1, disconnected: 1 },
  };
}

test.describe('Build a PC classroom player', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('emits semantic events, survives reset and obeys teacher pause', async ({ page }) => {
    let status: 'RUNNING' | 'PAUSED' = 'RUNNING';
    const semanticBodies: Array<Record<string, unknown>> = [];

    await page.route(`**/api/classroom-sessions/${SESSION_ID}/join`, async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'participant' }) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/me`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(studentProjection(status)) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/events`, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      semanticBodies.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          replayed: false,
          event: { id: `event-${semanticBodies.length}`, eventId: body.eventId, eventType: body.eventType },
          evidence: body.eventType === 'CHECKPOINT_COMPLETED'
            ? { id: `evidence-${semanticBodies.length}`, evidenceType: body.eventType }
            : null,
        }),
      });
    });

    await page.goto(`/app/labs/build-a-pc?session=${SESSION_ID}`);
    await expect(page.getByTestId('classroom-session-label')).toContainText('Sestav pracovní stanici');
    await expect(page.getByTestId('classroom-blocking-overlay')).toHaveCount(0);

    await page.getByTestId('component-cpu').click();
    await page.getByTestId('slot-cpu-socket').click();
    await expect(page.getByTestId('server-event-count')).toHaveText('2');

    expect(semanticBodies.map((body) => body.eventType)).toEqual([
      'COMPONENT_PLACED',
      'CHECKPOINT_COMPLETED',
    ]);
    for (const body of semanticBodies) {
      expect(body.stageId).toBe(STAGE_ID);
      const payload = body.payload as Record<string, unknown>;
      expect(Object.keys(payload).some((key) => /pointer|cursor|mouse|coordinate/i.test(key))).toBe(false);
    }

    await page.getByRole('button', { name: 'Resetovat sestavu' }).click();
    await expect(page.getByTestId('build-progress-label')).toHaveText('0 %');
    await page.getByTestId('component-cpu').click();
    await page.getByTestId('slot-cpu-socket').click();
    await expect(page.getByTestId('server-event-count')).toHaveText('4');

    status = 'PAUSED';
    await expect(page.getByTestId('classroom-blocking-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('classroom-session-label')).toContainText('pozastavena');
    await page.screenshot({ path: 'test-results/build-a-pc-classroom-paused.png', fullPage: true });

    status = 'RUNNING';
    await expect(page.getByTestId('classroom-blocking-overlay')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByTestId('pointer-stream-count')).toHaveText('0');
  });
});

test.describe('Build a PC Teacher Mission Control', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('drives START, PAUSE and RESUME with server revisions', async ({ page }) => {
    let status: 'DRAFT' | 'RUNNING' | 'PAUSED' = 'DRAFT';
    let revision = 0;
    const commands: Array<{ type: string; expectedRevision: number }> = [];

    await page.route(`**/api/classroom-sessions/${SESSION_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherProjection(status, revision)) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/commands`, async (route) => {
      const body = route.request().postDataJSON() as { type: 'START' | 'PAUSE' | 'RESUME'; expectedRevision: number };
      commands.push({ type: body.type, expectedRevision: body.expectedRevision });
      expect(body.expectedRevision).toBe(revision);
      revision += 1;
      status = body.type === 'START' || body.type === 'RESUME' ? 'RUNNING' : 'PAUSED';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ replayed: false, resultingRevision: revision, session: teacherProjection(status, revision) }),
      });
    });

    await page.goto(`/app/labs/build-a-pc/mission-control?session=${SESSION_ID}`);
    await expect(page.getByRole('heading', { name: 'Mission Control · Build a PC' })).toBeVisible();
    await expect(page.getByTestId('mission-status')).toHaveText('DRAFT');
    await expect(page.getByTestId('mission-connected')).toHaveText('1/2');

    await page.getByTestId('mission-start').click();
    await expect(page.getByTestId('mission-status')).toHaveText('RUNNING');
    await expect(page.getByTestId('mission-revision')).toHaveText('1');

    await page.getByTestId('mission-pause').click();
    await expect(page.getByTestId('mission-status')).toHaveText('PAUSED');
    await expect(page.getByTestId('mission-revision')).toHaveText('2');

    await page.getByTestId('mission-resume').click();
    await expect(page.getByTestId('mission-status')).toHaveText('RUNNING');
    await expect(page.getByTestId('mission-revision')).toHaveText('3');

    expect(commands).toEqual([
      { type: 'START', expectedRevision: 0 },
      { type: 'PAUSE', expectedRevision: 1 },
      { type: 'RESUME', expectedRevision: 2 },
    ]);

    await page.screenshot({ path: 'test-results/build-a-pc-mission-control.png', fullPage: true });
  });
});
