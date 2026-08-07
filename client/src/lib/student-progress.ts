import { fetchWithAuth } from '@/lib/http/client';
import type { StudentProgressDetail } from '@/lib/progress-api';

type StudentTimelineItem = StudentProgressDetail['timeline'][number];

export type StudentSelfProgress = Omit<
  StudentProgressDetail,
  'interventions' | 'summary' | 'timeline'
> & {
  summary: Omit<StudentProgressDetail['summary'], 'openInterventions'> & {
    openInterventions?: never;
  };
  timeline: Array<
    Omit<StudentTimelineItem, 'kind'> & {
      kind: Exclude<StudentTimelineItem['kind'], 'INTERVENTION'>;
    }
  >;
  interventions?: never;
};

/**
 * Student identity is server-derived; no student id is accepted here.
 * The student projection deliberately excludes interventions and their counters.
 */
export function getMyStudentProgress(): Promise<StudentSelfProgress> {
  return fetchWithAuth<StudentSelfProgress>('GET', '/progress/me');
}