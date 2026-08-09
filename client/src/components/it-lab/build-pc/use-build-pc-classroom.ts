'use client';

import {
  useClassroomActivity,
  type ClassroomActivityBridge,
} from '@/lib/use-classroom-activity';

export type BuildPcClassroomBridge = ClassroomActivityBridge;

export function useBuildPcClassroom(sessionId: string | null): BuildPcClassroomBridge {
  return useClassroomActivity(sessionId, 'pc');
}
