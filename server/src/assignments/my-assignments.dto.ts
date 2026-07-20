export type EffectiveAssignmentStatus =
  | 'UPCOMING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'CLOSED'
  | 'NO_ATTEMPTS_LEFT';

export type MyAssignmentDto = {
  id: string;
  testId: string;
  /** Title of the assigned test — the card headline in the student UI. */
  testTitle: string;
  /** Display name of the test's subject (catalog name wins), if any. */
  subjectName: string | null;
  classSectionId: string | null;
  organizationId: string;
  openAt: Date;
  closeAt: Date;
  maxAttempts: number;
  attemptNo: number;
  /** Total number of submission attempts the student has created for this assignment. */
  attemptsUsed: number;
  /** ID of the latest submission attempt, or null when no attempt exists yet. */
  submissionId: string | null;
  /** ISO string of the latest submission's submittedAt, or null if not yet submitted. */
  submittedAt: string | null;
  /** Status of the latest submission (PENDING | APPROVED | REJECTED) or null if no submission. */
  submissionStatus: string | null;
  /** Backend-computed state machine value. Single source of truth for the student CTA. */
  effectiveStatus: EffectiveAssignmentStatus;
};
