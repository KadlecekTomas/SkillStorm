import { fetchWithAuth } from '@/lib/http/client';

export type ProgressEntryType = 'ASSESSMENT' | 'COMMENT' | 'PRAISE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';
export type InterventionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type ProgressContext = {
  academicYear: { id: string; label: string };
  classes: Array<{
    id: string;
    label: string;
    grade: string;
    students: Array<{ id: string; name: string }>;
  }>;
  subjects: Array<{ id: string; name: string }>;
  competencies: Array<{
    id: string;
    subjectId: string | null;
    name: string;
    description: string | null;
    scaleMin: number;
    scaleMax: number;
  }>;
};

export type CreateProgressEntryInput = {
  studentId: string;
  subjectId?: string;
  competencyId?: string;
  type?: ProgressEntryType;
  gradeValue?: number;
  competencyLevel?: number;
  comment?: string;
  clientMutationId?: string;
  occurredAt?: string;
};

export type StudentProgressDetail = {
  student: {
    id: string;
    name: string;
    classSectionId: string;
    classLabel: string;
  };
  summary: {
    averageGrade: number | null;
    competencyMasteryPercent: number | null;
    attendanceRate: number | null;
    openInterventions?: number;
  };
  competencyMap: Array<{
    id: string;
    name: string;
    subjectName: string | null;
    level: number;
    scaleMin: number;
    scaleMax: number;
    updatedAt: string;
  }>;
  timeline: Array<{
    id: string;
    kind: 'GRADE' | 'COMPETENCY' | 'COMMENT' | 'PRAISE' | 'TEST' | 'ATTENDANCE' | 'INTERVENTION';
    occurredAt: string;
    title: string;
    detail: string | null;
    subjectName: string | null;
    authorName: string | null;
  }>;
  attendance: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  interventions?: Array<{
    id: string;
    title: string;
    note: string | null;
    status: InterventionStatus;
    subjectName: string | null;
    startedAt: string;
    resolvedAt: string | null;
  }>;
};

export type ProgressDashboard = {
  summary: {
    studentCount: number;
    averageGrade: number | null;
    averageCompetency: number | null;
    attendanceRate: number | null;
    openInterventions: number;
    progressEntries: number;
  };
  classes: Array<{
    classSectionId: string;
    classLabel: string;
    studentCount: number;
    averageGrade: number | null;
    averageCompetency: number | null;
    attendanceRate: number | null;
    openInterventions: number;
    progressEntries: number;
  }>;
};

type SyncEntriesResponse = {
  results: Array<{
    clientMutationId: string | null;
    status: 'SYNCED' | 'FAILED';
    error?: string;
  }>;
};

type AttendanceInput = {
  studentId: string;
  subjectId?: string;
  status: AttendanceStatus;
  minutesLate?: number;
  note?: string;
  occurredAt?: string;
};

type InterventionInput = {
  studentId: string;
  subjectId?: string;
  title: string;
  note?: string;
};

type CompetencyInput = {
  subjectId?: string;
  name: string;
  description?: string;
  scaleMin?: number;
  scaleMax?: number;
};

const syncEntriesInFlight = new Map<string, Promise<SyncEntriesResponse>>();

function syncEntriesKey(entries: CreateProgressEntryInput[]): string {
  return entries
    .map((entry) => entry.clientMutationId ?? JSON.stringify(entry))
    .sort()
    .join('|');
}

function syncEntries(entries: CreateProgressEntryInput[]): Promise<SyncEntriesResponse> {
  const key = syncEntriesKey(entries);
  const existing = syncEntriesInFlight.get(key);
  if (existing) return existing;

  const request = fetchWithAuth<SyncEntriesResponse>('POST', '/progress/sync', {
    body: { entries },
  });
  syncEntriesInFlight.set(key, request);
  void request
    .finally(() => {
      if (syncEntriesInFlight.get(key) === request) {
        syncEntriesInFlight.delete(key);
      }
    })
    .catch(() => undefined);
  return request;
}

export const progressApi = {
  context: (): Promise<ProgressContext> =>
    fetchWithAuth<ProgressContext>('GET', '/progress/context'),

  createEntry: (body: CreateProgressEntryInput): Promise<unknown> =>
    fetchWithAuth<unknown>('POST', '/progress/entries', { body }),

  syncEntries,

  student: (studentId: string): Promise<StudentProgressDetail> =>
    fetchWithAuth<StudentProgressDetail>('GET', `/progress/students/${studentId}`),

  guardianStudent: (studentId: string): Promise<StudentProgressDetail> =>
    fetchWithAuth<StudentProgressDetail>(
      'GET',
      `/progress/guardian/students/${studentId}`,
    ),

  dashboard: (): Promise<ProgressDashboard> =>
    fetchWithAuth<ProgressDashboard>('GET', '/progress/dashboard'),

  classDashboard: (
    classSectionId: string,
  ): Promise<ProgressDashboard['classes'][number]> =>
    fetchWithAuth<ProgressDashboard['classes'][number]>(
      'GET',
      `/progress/dashboard/classes/${classSectionId}`,
    ),

  createAttendance: (body: AttendanceInput): Promise<unknown> =>
    fetchWithAuth<unknown>('POST', '/progress/attendance', { body }),

  createIntervention: (body: InterventionInput): Promise<unknown> =>
    fetchWithAuth<unknown>('POST', '/progress/interventions', { body }),

  resolveIntervention: (interventionId: string): Promise<unknown> =>
    fetchWithAuth<unknown>(
      'PATCH',
      `/progress/interventions/${interventionId}/resolve`,
    ),

  createCompetency: (
    body: CompetencyInput,
  ): Promise<ProgressContext['competencies'][number]> =>
    fetchWithAuth<ProgressContext['competencies'][number]>(
      'POST',
      '/progress/competencies',
      { body },
    ),
};
