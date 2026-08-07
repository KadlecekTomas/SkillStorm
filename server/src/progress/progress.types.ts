export enum ProgressEntryType {
  ASSESSMENT = 'ASSESSMENT',
  COMMENT = 'COMMENT',
  PRAISE = 'PRAISE',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  EXCUSED = 'EXCUSED',
  LATE = 'LATE',
}

export enum InterventionStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

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
