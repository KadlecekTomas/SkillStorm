export type CoopPhase = 'WAITING' | 'PLAN' | 'PROGRAM';
export type CoopRole = 'PLANNER' | 'PROGRAMMER' | 'WAITING' | 'OBSERVER';

export type CoopPeer = {
  participantId: string;
  nickname: string;
  joinedAt: Date;
  connected: boolean;
};

export type CoopMarker = {
  eventType: 'COOP_ROLE_HANDOFF' | 'COOP_ROLE_ROTATED';
  round: number;
} | null;

export type CoopState = {
  round: number;
  phase: CoopPhase;
  plannerParticipantId: string | null;
  programmerParticipantId: string | null;
  roleByParticipantId: Record<string, CoopRole>;
};

export function resolveNetworkedCoopState(
  peers: CoopPeer[],
  marker: CoopMarker,
): CoopState {
  const ordered = [...peers].sort((a, b) => {
    const byTime = a.joinedAt.getTime() - b.joinedAt.getTime();
    return byTime !== 0 ? byTime : a.participantId.localeCompare(b.participantId);
  });

  const roleByParticipantId: Record<string, CoopRole> = {};
  for (const peer of ordered) roleByParticipantId[peer.participantId] = 'OBSERVER';

  if (ordered.length < 2) {
    for (const peer of ordered) roleByParticipantId[peer.participantId] = 'WAITING';
    return {
      round: 1,
      phase: 'WAITING',
      plannerParticipantId: null,
      programmerParticipantId: null,
      roleByParticipantId,
    };
  }

  const round = Math.max(1, marker?.round ?? 1);
  const first = ordered[0]!;
  const second = ordered[1]!;
  const swap = round % 2 === 0;
  const planner = swap ? second : first;
  const programmer = swap ? first : second;

  roleByParticipantId[planner.participantId] = 'PLANNER';
  roleByParticipantId[programmer.participantId] = 'PROGRAMMER';

  return {
    round,
    phase: marker?.eventType === 'COOP_ROLE_HANDOFF' ? 'PROGRAM' : 'PLAN',
    plannerParticipantId: planner.participantId,
    programmerParticipantId: programmer.participantId,
    roleByParticipantId,
  };
}
