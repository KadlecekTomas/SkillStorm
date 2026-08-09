import { LiveParticipantStatus } from '@prisma/client';
import { buildBuildPcAnalytics } from './build-pc-analytics.service';

describe('Build a PC classroom analytics', () => {
  it('prioritizes misconception clusters and students needing intervention', () => {
    const now = new Date('2026-08-09T12:10:00.000Z');
    const participants = [
      {
        id: 'p1',
        nickname: 'Adam',
        status: LiveParticipantStatus.CONNECTED,
        lastSeenAt: new Date('2026-08-09T12:09:59.000Z'),
      },
      {
        id: 'p2',
        nickname: 'Bára',
        status: LiveParticipantStatus.CONNECTED,
        lastSeenAt: new Date('2026-08-09T12:09:59.000Z'),
      },
    ];
    const events = [
      {
        participantId: 'p1',
        eventType: 'COMPONENT_PLACED',
        payload: { componentId: 'cpu', slotId: 'cpu-socket' },
        occurredAt: new Date('2026-08-09T12:00:10.000Z'),
      },
      {
        participantId: 'p1',
        eventType: 'PLACEMENT_REJECTED',
        payload: { componentId: 'ram', slotId: 'gpu-slot' },
        occurredAt: new Date('2026-08-09T12:01:00.000Z'),
      },
      {
        participantId: 'p1',
        eventType: 'PLACEMENT_REJECTED',
        payload: { componentId: 'ram', slotId: 'gpu-slot' },
        occurredAt: new Date('2026-08-09T12:01:05.000Z'),
      },
      {
        participantId: 'p2',
        eventType: 'PLACEMENT_REJECTED',
        payload: { componentId: 'ram', slotId: 'gpu-slot' },
        occurredAt: new Date('2026-08-09T12:02:00.000Z'),
      },
      {
        participantId: 'p2',
        eventType: 'HINT_REQUESTED',
        payload: { checkpoint: 'ram' },
        occurredAt: new Date('2026-08-09T12:09:30.000Z'),
      },
      {
        participantId: 'p2',
        eventType: 'HINT_REQUESTED',
        payload: { checkpoint: 'ram' },
        occurredAt: new Date('2026-08-09T12:09:40.000Z'),
      },
    ];

    const result = buildBuildPcAnalytics('session-1', participants, events, now);

    expect(result.topMisconception).toEqual({
      key: 'ram:gpu-slot',
      label: 'RAM → PCIe slot',
      count: 3,
      participantCount: 2,
    });
    expect(result.classSummary.totalRejectedPlacements).toBe(3);
    expect(result.classSummary.totalHints).toBe(2);
    expect(result.classSummary.needsAttention).toBe(2);
    expect(result.participants.map((participant) => participant.nickname)).toEqual([
      'Adam',
      'Bára',
    ]);
  });

  it('treats POST completion as completion, not mastery', () => {
    const participant = {
      id: 'p1',
      nickname: 'Filip',
      status: LiveParticipantStatus.CONNECTED,
      lastSeenAt: new Date('2026-08-09T12:00:00.000Z'),
    };
    const events = [
      {
        participantId: 'p1',
        eventType: 'CHECKPOINT_COMPLETED',
        payload: { checkpoint: 'POST_OK', completionIsMastery: false },
        occurredAt: new Date('2026-08-09T12:00:00.000Z'),
      },
    ];

    const result = buildBuildPcAnalytics(
      'session-1',
      [participant],
      events,
      new Date('2026-08-09T12:05:00.000Z'),
    );

    expect(result.classSummary.completed).toBe(1);
    expect(result.participants[0]).toMatchObject({
      completed: true,
      progressPct: 100,
      needsAttention: false,
    });
  });
});
