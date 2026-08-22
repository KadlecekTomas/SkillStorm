import { fetchWithAuth } from '@/lib/http/client';
import type { ClassroomDeliveryMode } from '@/lib/classroom-session-api';

export type LessonExperienceStage = {
  id: string;
  stageKey: string;
  orderIndex: number;
  stageType: string;
  title: string;
  studentPrompt: string | null;
  teacherGuidance: string | null;
  durationMin: number;
  activityVersionId: string | null;
  completionType: string;
  checkpoint: boolean;
  required: boolean;
  teacherIntervention: boolean;
};

export type LessonExperienceVersion = {
  id: string;
  versionNo: number;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED';
  title: string;
  summary: string | null;
  learningObjective: string;
  supportedModes: ClassroomDeliveryMode[];
  recommendedMode: ClassroomDeliveryMode;
  estimatedDurationMin: number;
  stages: LessonExperienceStage[];
};

export type LessonExperience = {
  id: string;
  scope: 'GLOBAL' | 'ORGANIZATION';
  organizationId: string | null;
  slug: string;
  title: string;
  description: string | null;
  updatedAt: string;
  versions: LessonExperienceVersion[];
};

export const lessonExperienceApi = {
  list: (): Promise<LessonExperience[]> =>
    fetchWithAuth<LessonExperience[]>('GET', '/lesson-experiences', {
      cache: 'no-store',
    }),

  get: (lessonId: string): Promise<LessonExperience> =>
    fetchWithAuth<LessonExperience>('GET', `/lesson-experiences/${lessonId}`, {
      cache: 'no-store',
    }),
};
