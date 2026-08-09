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
    stages: [
      {
        id: 'stage-algorithm',
        stageKey: 'ALGORITHM_LAB',
        orderIndex: 0,
        stageType: 'PROGRAM',
        title: 'Robot Rescue',
        activityVersionId: null,
        completionType: 'CHECKPOINT',
        checkpoint: true,
      },
    ],
  },
  groups: [
    { id: GROUP_A, label: 'Dvojice 1', orderIndex: 0 },
    { id: GROUP_B, label: 'Dvojice 2', orderIndex: 1 },
  ],
  participants: [],
  participantSummary: { total: 4, connected: 3, disconnected: 1 },
};

const analytics = {
  sessionId: SESSION_ID,
  generatedAt: '2026-08-09T18:05:00.000Z',
  session: {
    status: 'RUNNING',
    mode: 'HYBRID',
    stateRevision: 7,
    lessonTitle: 'Robot Rescue',
    stageTitle: 'Robot Rescue',
  },
  summary: {
    groups: 2,
    connectedPairs: 1,
    needsAttention: 1,
    waiting: 0,
    totalProgramRuns: 5,
    totalFailures: 2,
  },
  reactor: {
    earnedEnergy: 8,
    maxEnergy: 12,
    progressPct: 67,
    level: 'ORBIT',
    label: 'Orbit locked',
    nextLevelAt: 75,
    rankingEnabled: false,
    masteryImpact: false,
  },
  groups: [
    {
      groupId: GROUP_B,
      label: 'Dvojice 2',
      round: 2,
      phase: 'PLAN',
      plannerParticipantId: 'p3',
      programmerParticipantId: 'p4',
      members: [
        { participantId: 'p3', nickname: 'Eliška', connected: true, role: 'PLANNER' },
        { participantId: 'p4', nickname: 'Kuba', connected: false, role: 'PROGRAMMER' },
      ],
      programLength: 0,
      programRevision: 0,
      failures: 2,
      hints: 1,
      runs: 2,
      debugHypotheses: 1,
      needsAttention: true,
      missionEnergy: 4,
      milestones: {
        pairOnline: false,
        handedOff: true,
        programStarted: true,
        debugLoop: true,
        roleRotated: true,
        askedForHelp: false,
      },
      lastEventAt: '2026-08-09T18:04:00.000Z',
    },
    {
      groupId: GROUP_A,
      label: 'Dvojice 1',
      round: 1,
      phase: 'PROGRAM',
      plannerParticipantId: 'p1',
      programmerParticipantId: 'p2',
      members: [
        { participantId: 'p1', nickname: 'Ada', connected: true, role: 'PLANNER' },
        { participantId: 'p2', nickname: 'Karel', connected: true, role: 'PROGRAMMER' },
      ],
      programLength: 5,
      programRevision: 3,
      failures: 0,
      hints: 0,
      runs: 3,
      debugHypotheses: 0,
      needsAttention: false,
      missionEnergy: 4,
      milestones: {
        pairOnline: true,
        handedOff: true,
        programStarted: true,
        debugLoop: false,
        roleRotated: false,
        askedForHelp: true,
      },
      lastEventAt: '2026-08-09T18:04:30.000Z',
    },
  ],
  ungrouped: [],
  privacy: {
    pointerStreams: 0,
    publicLeaderboard: false,
    rawScreenTelemetry: false,
  },
};

test.describe('Algorithm Lab teacher Mission Control', () => {
  test.use({ storageState: storageStateFor('teacher') });

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

    await page.screenshot({
      path: 'test-results/algorithm-lab-15-mission-control-reactor.png',
      fullPage: true,
    });
  });
});
