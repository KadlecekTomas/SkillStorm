import { fetchWithAuth } from '@/lib/http/client';
import type { StudentProgressDetail } from '@/lib/progress-api';

/** Student identity is server-derived; no student id is accepted here. */
export function getMyStudentProgress(): Promise<StudentProgressDetail> {
  return fetchWithAuth<StudentProgressDetail>('GET', '/progress/me');
}
