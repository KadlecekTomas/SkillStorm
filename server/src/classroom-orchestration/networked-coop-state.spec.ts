import { resolveNetworkedCoopState } from './networked-coop-state';

describe('resolveNetworkedCoopState', () => {
  const peers = [
    {
      participantId: 'p1',
      nickname: 'Ada',
      joinedAt: new Date('2026-08-09T12:00:00.000Z'),
      connected: true,
    },
    {
      participantId: 'p2',
      nickname: 'Karel',
      joinedAt: new Date('2026-08-09T12:00:01.000Z'),
      connected: true,
    },
  ];

  it('waits until a pair exists', () => {
    const state = resolveNetworkedCoopState([peers[0]!], null);
    expect(state.phase).toBe('WAITING');
    expect(state.roleByParticipantId.p1).toBe('WAITING');
  });

  it('starts round one with first participant as planner', () => {
    const state = resolveNetworkedCoopState(peers, null);
    expect(state.phase).toBe('PLAN');
    expect(state.round).toBe(1);
    expect(state.plannerParticipantId).toBe('p1');
    expect(state.programmerParticipantId).toBe('p2');
  });

  it('moves to programmer after planner handoff', () => {
    const state = resolveNetworkedCoopState(peers, {
      eventType: 'COOP_ROLE_HANDOFF',
      round: 1,
    });
    expect(state.phase).toBe('PROGRAM');
    expect(state.roleByParticipantId.p1).toBe('PLANNER');
    expect(state.roleByParticipantId.p2).toBe('PROGRAMMER');
  });

  it('swaps roles on round two', () => {
    const state = resolveNetworkedCoopState(peers, {
      eventType: 'COOP_ROLE_ROTATED',
      round: 2,
    });
    expect(state.phase).toBe('PLAN');
    expect(state.plannerParticipantId).toBe('p2');
    expect(state.programmerParticipantId).toBe('p1');
  });

  it('keeps extra group members as observers instead of fabricating evidence roles', () => {
    const state = resolveNetworkedCoopState(
      [
        ...peers,
        {
          participantId: 'p3',
          nickname: 'Observer',
          joinedAt: new Date('2026-08-09T12:00:02.000Z'),
          connected: true,
        },
      ],
      null,
    );
    expect(state.roleByParticipantId.p3).toBe('OBSERVER');
  });
});
