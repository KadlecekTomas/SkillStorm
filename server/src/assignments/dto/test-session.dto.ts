// Bootstrap payload for the student "Focus Test Mode" session.
// IMPORTANT: questions intentionally OMIT correctAnswer/correctAnswers — never leak the answer key.
import type { QuestionType, SubmissionStatus } from '@prisma/client';

export interface TestSessionQuestionDto {
  id: string;
  text: string;
  type: QuestionType;
  options: Array<{ id: string; text: string }>;
}

export interface TestSessionDto {
  assignment: {
    id: string;
    title: string;
    openAt: string;
    closeAt: string;
    maxAttempts: number;
    timeLimitSec: number | null;
    showExplain: string;
  };
  test: {
    id: string;
    title: string;
    description: string | null;
    questions: TestSessionQuestionDto[];
  };
  submission: {
    id: string;
    attemptNo: number;
    status: SubmissionStatus;
    /** Server-side start of the attempt (Submission.createdAt). The timer is anchored here, never to the client clock. */
    startedAt: string;
    updatedAt: string;
    submittedAt: string | null;
  };
  /** Persisted responses of the resumed submission so the client can rehydrate previously saved answers. */
  responses: Array<{ questionId: string; givenText: string }>;
  /**
   * Presentation hint for the age-appropriate answering UI on the client.
   * Derived from the student's ACTIVE enrollment in the active academic year;
   * null when the student has no enrollment (client falls back to the "old" mode).
   */
  student: {
    grade: string | null;
  };
}
