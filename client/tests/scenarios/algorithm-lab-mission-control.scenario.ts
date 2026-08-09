import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const SESSION_ID = '12111111-1111-4111-8111-111111111111';
const GROUP_A = '56555555-5555-4555-8555-555555555555';
const GROUP_B = '89888888-8888-4888-8888-888888888888';

const teacherProjection = {
  id: SESSION_ID,
  sourceKind: 'LESSON_EXPERIENCE',
  status: 'RUNNING',
  mode: 'HYBRID',
  stateRevision: 7,
  classSectionId: 'class-8a',
  startedAt: '2026-08-09T18:00:00.000Z',
  pausedAt: null,
  finishedAt: null,
  currentLessonStageId: 'stage-algorithm',
  lesson: {
    id: 'lesson-algorithm',
    title: 'Robot Rescue',
    versionId: 'version-algorithm',
    versionNo: 1,
    stages: [{
      id: 'stage-algorithm',
      stageKey: 'ALGORITHM_LAB',
      orderIndex: 0,
      stageType: 'PROGRAM',
      title: 'Robot Rescue',
      activityVersionId: null,
      completionType: 'CHECKPOINT',
      checkpoint: true,
    }],
  },
  groups: [
    { id: GROUP_A, label: 'Dvojice 1', orderIndex: 0 },
    { id: GROUP_B, label: 'Dvojice 2', orderIndex: 1 },
  ],
  participants: [],
  participantSummary: { total: 4, connected: 3, disconnected: 1 },
};

const draftProjection = {
  ...teacherProjection,
  status: 'DRAFT',
  stateRevision: 0,
  startedAt: null,
  currentLessonStageId: null,
  groups: [],
  participants: [],
  participantSummary: { total: 0, connected: 0, disconnected: 0 },
};

const analytics = {
  sessionId: SESSION_ID,
  generatedAt: '2026-08-09T18:05:00.000Z',
  session: {
    status: 'RUNNING', mode: 'HYBRID', stateRevision: 7,
    lessonTitle: 'Robot Rescue', stageTitle: 'Robot Rescue',
  },
  summary: {
    groups: 2, connectedPairs: 1, needsAttention: 1, waiting: 0,
    totalProgramRuns: 5, totalFailures: 2,
  },
  reactor: {
    earnedEnergy: 8, maxEnergy: 12, progressPct: 67, level: 'ORBIT',
    label: 'Orbit locked', nextLevelAt: 75, rankingEnabled: false, masteryImpact: false,
  },
  groups: [
    {
      groupId: GROUP_B, label: 'Dvojice 2', round: 2, phase: 'PLAN',
      plannerParticipantId: 'p3', programmerParticipantId: 'p4',
      members: [
        { participantId: 'p3', nickname: 'Eliška', connected: true, role: 'PLANNER' },
        { participantId: 'p4', nickname: 'Kuba', connected: false, role: 'PROGRAMMER' },
      ],
      programLength: 0, programRevision: 0, failures: 2, hints: 1, runs: 2,
      debugHypotheses: 1, needsAttention: true, missionEnergy: 4,
      milestones: {
        pairOnline: false, handedOff: true, programStarted: true,
        debugLoop: true, roleRotated: true, askedForHelp: false,
      },
      lastEventAt: '2026-08-09T18:04:00.000Z',
    },
    {
      groupId: GROUP_A, label: 'Dvojice 1', round: 1, phase: 'PROGRAM',
      plannerParticipantId: 'p1', programmerParticipantId: 'p2',
      members: [
        { participantId: 'p1', nickname: 'Ada', connected: true, role: 'PLANNER' },
        { participantId: 'p2', nickname: 'Karel', connected: true, role: 'PROGRAMMER' },
      ],
      programLength: 5, programRevision: 3, failures: 0, hints: 0, runs: 3,
      debugHypotheses: 0, needsAttention: false, missionEnergy: 4,
      milestones: {
        pairOnline: true, handedOff: true, programStarted: true,
        debugLoop: false, roleRotated: false, askedForHelp: true,
      },
      lastEventAt: '2026-08-09T18:04:30.000Z',
    },
  ],
  ungrouped: [],
  privacy: { pointerStreams: 0, publicLeaderboard: false, rawScreenTelemetry: false },
};

test.describe('Algorithm Lab teacher Mission Control', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('starts from one action and exposes QR, short code and one common entry', async ({ page }) => {
    await page.route('**/api/classroom-sessions/algorithm-lab/quick-start', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(draftProjection) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/algorithm-lab-analytics`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...analytics,
          session: { ...analytics.session, status: 'DRAFT', stateRevision: 0, stageTitle: null },
          summary: { ...analytics.summary, groups: 0, connectedPairs: 0, needsAttention: 0, waiting: 0, totalProgramRuns: 0, totalFailures: 0 },
          reactor: { ...analytics.reactor, earnedEnergy: 0, maxEnergy: 1, progressPct: 0, level: 'BOOT', label: 'Boot sequence', nextLevelAt: 25 },
          groups: [],
        }),
      });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftProjection) });
    });

    await page.goto('/app/labs/algorithm-lab/mission-control');
    await expect(page.getByRole('heading', { name: 'Jedno tlačítko. Jedna společná hodina.' })).toBeVisible();
    await page.getByTestId('algorithm-quick-start').click();

    await expect(page).toHaveURL(new RegExp(`session=${SESSION_ID}`));
    await expect(page.getByTestId('algorithm-class-link-card')).toBeVisible();
    await expect(page.getByTestId('algorithm-class-code')).toHaveText('1211-1111');
    await expect(page.getByTestId('algorithm-class-qr')).toBeVisible();
    await expect(page.getByTestId('algorithm-class-link')).toContainText('/app/labs/algorithm-lab/join?code=1211-1111');

    await page.screenshot({
      path: 'test-results/algorithm-lab-16-one-click-classroom.png',
      fullPage: true,
    });
  });

  test('prioritizes intervention and uses cooperative reactor instead of leaderboard', async ({ page }) => {
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/algorithm-lab-analytics`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analytics) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherProjection) });
    });

    await page.goto(`/app/labs/algorithm-lab/mission-control?session=${SESSION_ID}`);
    await expect(page.getByTestId('algorithm-reactor-progress')).toHaveText('67%');
    await expect(page.getByTestId(`algorithm-pair-${GROUP_B}`)).toContainText('Zásah');
    await expect(page.getByTestId(`algorithm-pair-${GROUP_A}`)).toContainText('Ada');
    await expect(page.getByText('Gamifikace bez leaderboardu')).toBeVisible();
    await expect(page.getByText('0 pointer streams')).toBeVisible();
    await expect(page.getByTestId('algorithm-class-link-card')).toBeVisible();

    await page.screenshot({
      path: 'test-results/algorithm-lab-15-mission-control-reactor.png',
      fullPage: true,
    });
  });
});

test.describe('Algorithm Lab classroom code entry', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('resolves a scanned classroom code and enters the exact live session', async ({ page }) => {
    await page.route('**/api/classroom-sessions/algorithm-lab/resolve-code/1211-1111', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessionId: SESSION_ID }) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/join`, async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'participant-1', groupId: GROUP_A }) });
    });
    await page.route(`**/api/classroom-sessions/${SESSION_ID}/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: SESSION_ID,
          status: 'DRAFT',
          mode: 'HYBRID',
          stateRevision: 0,
          startedAt: null,
          pausedAt: null,
          finishedAt: null,
          participant: { id: 'participant-1', groupId: GROUP_A, status: 'CONNECTED', lastSeenAt: '2026-08-09T18:00:00.000Z' },
          currentStage: null,
        }),
      });
    });

    await page.goto('/app/labs/algorithm-lab/join?code=1211-1111');
    await expect(page.getByTestId('algorithm-code-auto-join')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/app/labs/algorithm-lab\\?session=${SESSION_ID}`));
    await expect(page.getByTestId('algorithm-classroom-session-label')).toContainText('Čeká se na spuštění');
  });
});
