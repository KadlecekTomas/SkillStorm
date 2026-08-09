import { LiveParticipantStatus, LiveSessionMode, LiveSessionStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import { AlgorithmLabAnalyticsService } from './algorithm-lab-analytics.service';

describe('Algorithm Lab Mission Control analytics', () => {
  it('surfaces intervention first and keeps reactor independent of ranking/mastery', async () => {
    const classroom = {
      getTeacherProjection: jest.fn().mockResolvedValue({
        status: LiveSessionStatus.RUNNING,
        mode: LiveSessionMode.HYBRID,
        stateRevision: 4,
        currentLessonStageId: 'stage-1',
        lesson: {
          title: 'Robot Rescue',
          stages: [{ id: 'stage-1', title: 'Robot Rescue' }],
        },
        groups: [
          { id: 'g1', label: 'Dvojice 1' },
          { id: 'g2', label: 'Dvojice 2' },
        ],
        participants: [
          {
            id: 'p1',
            nickname: 'Ada',
            groupId: 'g1',
            joinedAt: new Date('2026-08-09T10:00:00Z'),
            status: LiveParticipantStatus.CONNECTED,
          },
          {
            id: 'p2',
            nickname: 'Karel',
            groupId: 'g1',
            joinedAt: new Date('2026-08-09T10:00:01Z'),
            status: LiveParticipantStatus.CONNECTED,
          },
          {
            id: 'p3',
            nickname: 'Eliška',
            groupId: 'g2',
            joinedAt: new Date('2026-08-09T10:00:02Z'),
            status: LiveParticipantStatus.CONNECTED,
          },
          {
            id: 'p4',
            nickname: 'Kuba',
            groupId: 'g2',
            joinedAt: new Date('2026-08-09T10:00:03Z'),
            status: LiveParticipantStatus.DISCONNECTED,
          },
        ],
      }),
    } as unknown as ClassroomOrchestrationService;

    const prisma = {
      liveSemanticEvent: {
        findMany: jest.fn().mockResolvedValue([
          { participantId: 'p1', eventType: 'COOP_ROLE_HANDOFF', payload: { round: 1 }, receivedAt: new Date('2026-08-09T10:01:00Z') },
          { participantId: 'p2', eventType: 'COOP_PROGRAM_UPDATED', payload: { round: 1, programRevision: 1, commands: ['FORWARD'] }, receivedAt: new Date('2026-08-09T10:01:05Z') },
          { participantId: 'p2', eventType: 'PROGRAM_RUN', payload: { collaborationRound: 1 }, receivedAt: new Date('2026-08-09T10:01:10Z') },
          { participantId: 'p3', eventType: 'COOP_ROLE_HANDOFF', payload: { round: 1 }, receivedAt: new Date('2026-08-09T10:02:00Z') },
          { participantId: 'p4', eventType: 'PROGRAM_RUN', payload: { collaborationRound: 1 }, receivedAt: new Date('2026-08-09T10:02:10Z') },
          { participantId: 'p4', eventType: 'TEST_FAILED', payload: { collaborationRound: 1 }, receivedAt: new Date('2026-08-09T10:02:15Z') },
          { participantId: 'p4', eventType: 'HINT_REQUESTED', payload: { collaborationRound: 1 }, receivedAt: new Date('2026-08-09T10:02:20Z') },
        ]),
      },
    } as unknown as PrismaService;

    const service = new AlgorithmLabAnalyticsService(prisma, classroom);
    const result = await service.get('session-1', {} as never);

    expect(result.groups[0]).toMatchObject({
      groupId: 'g2',
      needsAttention: true,
      failures: 1,
      hints: 1,
    });
    expect(result.summary.needsAttention).toBe(1);
    expect(result.reactor.rankingEnabled).toBe(false);
    expect(result.reactor.masteryImpact).toBe(false);
    expect(result.privacy).toEqual({
      pointerStreams: 0,
      publicLeaderboard: false,
      rawScreenTelemetry: false,
    });
  });
});
