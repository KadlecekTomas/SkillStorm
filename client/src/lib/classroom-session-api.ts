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
  groups: Array<{
    id: string;
    label: string;
    orderIndex: number;
  }>;
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
  participantSummary: {
    total: number;
    connected: number;
    disconnected: number;
  };
};

export type LiveSemanticEventType =
  | 'PREDICTION_SUBMITTED'
  | 'COMPONENT_PLACED'
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

function commandId(type: ClassroomCommandType): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `mission-${type.toLowerCase()}-${suffix}`;
}

export const classroomSessionApi = {
  joinStudent: (sessionId: string): Promise<unknown> =>
    fetchWithAuth<unknown>('POST', `/classroom-sessions/${sessionId}/join`, {
      body: {},
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
