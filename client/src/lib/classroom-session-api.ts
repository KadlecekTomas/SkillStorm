import { fetchWithAuth } from '@/lib/http/client';

export type ClassroomSessionStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'FINISHED';
export type ClassroomDeliveryMode = 'BOARD_ONLY' | 'SHARED_DEVICES' | 'DEVICES' | 'HYBRID';
export type ClassroomCommandType = 'START' | 'PAUSE' | 'RESUME' | 'NEXT_STAGE' | 'FINISH';

export type ClassroomStage = {
  id: string;
  stageKey: string;
  orderIndex: number;
  stageType: string;
  title: string;
  activityVersionId: string | null;
  completionType: string;
  checkpoint: boolean;
};

export type StudentClassroomSessionProjection = {
  id: string;
  status: ClassroomSessionStatus;
  mode: ClassroomDeliveryMode;
  stateRevision: number;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  participant: {
    id: string;
    groupId: string | null;
    status: 'CONNECTED' | 'DISCONNECTED';
    lastSeenAt: string;
  };
  currentStage: ClassroomStage | null;
};

export type TeacherClassroomSessionProjection = {
  id: string;
  sourceKind: 'LESSON_EXPERIENCE';
  status: ClassroomSessionStatus;
  mode: ClassroomDeliveryMode;
  stateRevision: number;
  classSectionId: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  currentLessonStageId: string | null;
  lesson: {
    id: string;
    title: string;
    versionId: string;
    versionNo: number;
    stages: ClassroomStage[];
  };
  groups: Array<{ id: string; label: string; orderIndex: number }>;
  participants: Array<{
    id: string;
    nickname: string | null;
    membershipId: string | null;
    groupId: string | null;
    status: 'CONNECTED' | 'DISCONNECTED';
    joinedAt: string;
    lastSeenAt: string;
    disconnectedAt: string | null;
  }>;
  participantSummary: { total: number; connected: number; disconnected: number };
};

export type BuildPcAnalyticsProjection = {
  sessionId: string;
  generatedAt: string;
  classSummary: {
    total: number;
    connected: number;
    completed: number;
    needsAttention: number;
    averageProgressPct: number;
    totalHints: number;
    totalRejectedPlacements: number;
  };
  topMisconception: {
    key: string;
    label: string;
    count: number;
    participantCount: number;
  } | null;
  misconceptionClusters: Array<{
    key: string;
    label: string;
    componentId: string | null;
    slotId: string | null;
    count: number;
    participantCount: number;
  }>;
  participants: Array<{
    participantId: string;
    nickname: string;
    status: 'CONNECTED' | 'DISCONNECTED';
    installedCount: number;
    totalComponents: number;
    progressPct: number;
    hintCount: number;
    rejectedPlacements: number;
    lastCheckpoint: string | null;
    lastEventAt: string | null;
    completed: boolean;
    stalled: boolean;
    needsAttention: boolean;
  }>;
};

export type AlgorithmLabAnalyticsProjection = {
  sessionId: string;
  generatedAt: string;
  session: {
    status: ClassroomSessionStatus;
    mode: ClassroomDeliveryMode;
    stateRevision: number;
    lessonTitle: string;
    stageTitle: string | null;
  };
  summary: {
    groups: number;
    connectedPairs: number;
    needsAttention: number;
    waiting: number;
    totalProgramRuns: number;
    totalFailures: number;
  };
  reactor: {
    earnedEnergy: number;
    maxEnergy: number;
    progressPct: number;
    level: 'BOOT' | 'PULSE' | 'ORBIT' | 'NOVA';
    label: string;
    nextLevelAt: number;
    rankingEnabled: false;
    masteryImpact: false;
  };
  groups: Array<{
    groupId: string;
    label: string;
    round: number;
    phase: 'WAITING' | 'PLAN' | 'PROGRAM';
    plannerParticipantId: string | null;
    programmerParticipantId: string | null;
    members: Array<{
      participantId: string;
      nickname: string;
      connected: boolean;
      role: 'PLANNER' | 'PROGRAMMER' | 'WAITING' | 'OBSERVER';
    }>;
    programLength: number;
    programRevision: number;
    failures: number;
    hints: number;
    runs: number;
    debugHypotheses: number;
    needsAttention: boolean;
    missionEnergy: number;
    milestones: {
      pairOnline: boolean;
      handedOff: boolean;
      programStarted: boolean;
      debugLoop: boolean;
      roleRotated: boolean;
      askedForHelp: boolean;
    };
    lastEventAt: string | null;
  }>;
  ungrouped: Array<{ participantId: string; nickname: string; connected: boolean }>;
  privacy: {
    pointerStreams: 0;
    publicLeaderboard: false;
    rawScreenTelemetry: false;
  };
};

export type NetworkedCoopRole = 'PLANNER' | 'PROGRAMMER' | 'WAITING' | 'OBSERVER';
export type NetworkedCoopPhase = 'WAITING' | 'PLAN' | 'PROGRAM';

export type NetworkedCoopProjection = {
  sessionId: string;
  sessionStatus: ClassroomSessionStatus;
  sessionRevision: number;
  stageId: string | null;
  groupId: string;
  participantId: string;
  round: number;
  phase: NetworkedCoopPhase;
  myRole: NetworkedCoopRole;
  canAct: boolean;
  plannerParticipantId: string | null;
  programmerParticipantId: string | null;
  peers: Array<{
    participantId: string;
    nickname: string;
    connected: boolean;
    role: NetworkedCoopRole;
  }>;
};

export type NetworkedCoopTransitionResult = {
  replayed: boolean;
  state: NetworkedCoopProjection;
};

export type CoopAlgorithmCommand = 'FORWARD' | 'LEFT' | 'RIGHT';

export type NetworkedCoopProgram = {
  groupId: string;
  round: number;
  programRevision: number;
  commands: CoopAlgorithmCommand[];
  updatedByParticipantId: string | null;
};

export type NetworkedCoopProgramUpdateResult = {
  replayed: boolean;
  program: NetworkedCoopProgram;
};

export type LiveSemanticEventType =
  | 'PREDICTION_SUBMITTED'
  | 'ALGORITHM_STEP_ADDED'
  | 'PROGRAM_RUN'
  | 'TEST_FAILED'
  | 'DEBUG_HYPOTHESIS_SUBMITTED'
  | 'COMPONENT_PLACED'
  | 'PLACEMENT_REJECTED'
  | 'MEASUREMENT_TAKEN'
  | 'MODEL_CHANGED'
  | 'HINT_REQUESTED'
  | 'CHECKPOINT_COMPLETED'
  | 'EXPLANATION_SUBMITTED';

export type SemanticEventInput = {
  eventId: string;
  stageId: string;
  eventType: LiveSemanticEventType;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

export type SemanticEventResult = {
  replayed: boolean;
  event: { id: string; eventId: string; eventType: string };
  evidence: { id: string; evidenceType: string } | null;
};

export type ClassroomCommandResult = {
  replayed: boolean;
  resultingRevision: number;
  session: TeacherClassroomSessionProjection;
};

function uniqueId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `${prefix}-${suffix}`;
}

function commandId(type: ClassroomCommandType): string {
  return uniqueId(`mission-${type.toLowerCase()}`);
}

export const classroomSessionApi = {
  joinStudent: (sessionId: string, groupId?: string | null): Promise<unknown> =>
    fetchWithAuth<unknown>('POST', `/classroom-sessions/${sessionId}/join`, {
      body: groupId ? { groupId } : {},
    }),

  studentProjection: (sessionId: string): Promise<StudentClassroomSessionProjection> =>
    fetchWithAuth<StudentClassroomSessionProjection>(
      'GET',
      `/classroom-sessions/${sessionId}/me`,
      { cache: 'no-store' },
    ),

  teacherProjection: (sessionId: string): Promise<TeacherClassroomSessionProjection> =>
    fetchWithAuth<TeacherClassroomSessionProjection>(
      'GET',
      `/classroom-sessions/${sessionId}`,
      { cache: 'no-store' },
    ),

  buildPcAnalytics: (sessionId: string): Promise<BuildPcAnalyticsProjection> =>
    fetchWithAuth<BuildPcAnalyticsProjection>(
      'GET',
      `/classroom-sessions/${sessionId}/build-pc-analytics`,
      { cache: 'no-store' },
    ),

  algorithmLabAnalytics: (sessionId: string): Promise<AlgorithmLabAnalyticsProjection> =>
    fetchWithAuth<AlgorithmLabAnalyticsProjection>(
      'GET',
      `/classroom-sessions/${sessionId}/algorithm-lab-analytics`,
      { cache: 'no-store' },
    ),

  networkedCoop: (sessionId: string): Promise<NetworkedCoopProjection> =>
    fetchWithAuth<NetworkedCoopProjection>(
      'GET',
      `/classroom-sessions/${sessionId}/coop`,
      { cache: 'no-store' },
    ),

  networkedCoopTransition: (
    sessionId: string,
    action: 'HANDOFF' | 'ROTATE',
    reason?: string,
  ): Promise<NetworkedCoopTransitionResult> =>
    fetchWithAuth<NetworkedCoopTransitionResult>(
      'POST',
      `/classroom-sessions/${sessionId}/coop/transition`,
      {
        body: {
          transitionId: uniqueId('coop'),
          action,
          ...(reason ? { reason } : {}),
        },
      },
    ),

  networkedCoopProgram: (sessionId: string): Promise<NetworkedCoopProgram> =>
    fetchWithAuth<NetworkedCoopProgram>(
      'GET',
      `/classroom-sessions/${sessionId}/coop/program`,
      { cache: 'no-store' },
    ),

  updateNetworkedCoopProgram: (
    sessionId: string,
    expectedProgramRevision: number,
    commands: CoopAlgorithmCommand[],
  ): Promise<NetworkedCoopProgramUpdateResult> =>
    fetchWithAuth<NetworkedCoopProgramUpdateResult>(
      'PUT',
      `/classroom-sessions/${sessionId}/coop/program`,
      {
        body: {
          operationId: uniqueId('coop-program'),
          expectedProgramRevision,
          commands,
        },
      },
    ),

  command: (
    sessionId: string,
    type: ClassroomCommandType,
    expectedRevision: number,
  ): Promise<ClassroomCommandResult> =>
    fetchWithAuth<ClassroomCommandResult>(
      'POST',
      `/classroom-sessions/${sessionId}/commands`,
      {
        body: {
          commandId: commandId(type),
          type,
          expectedRevision,
        },
      },
    ),

  sendSemanticEvent: (
    sessionId: string,
    body: SemanticEventInput,
  ): Promise<SemanticEventResult> =>
    fetchWithAuth<SemanticEventResult>(
      'POST',
      `/classroom-sessions/${sessionId}/events`,
      { body },
    ),
};
