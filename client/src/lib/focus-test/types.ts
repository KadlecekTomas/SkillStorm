// Shared types for the student "Focus Test Mode".
// Mirrors the sanitized payload from GET /assignments/:id/test-session — the answer key is never present.

export type FocusQuestionType =
  | "TRUE_FALSE"
  | "FILL_IN_THE_BLANK"
  | "MULTIPLE_CHOICE";

export interface FocusQuestion {
  id: string;
  text: string;
  type: FocusQuestionType;
  options: Array<{ id: string; text: string }>;
}

export interface FocusTestSession {
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
    questions: FocusQuestion[];
  };
  submission: {
    id: string;
    attemptNo: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    startedAt: string;
    updatedAt: string;
    submittedAt: string | null;
  };
  responses: Array<{ questionId: string; givenText: string }>;
}

/** Answers are kept as a single string per question (the student payload exposes no multi-select key). */
export type AnswerMap = Record<string, string>;

export interface TestDraft {
  assignmentId: string;
  submissionId: string;
  answers: AnswerMap;
  /** Epoch ms of the last local mutation. Used for last-write-wins reconciliation. */
  updatedAt: number;
  /** Questions changed locally that are not yet confirmed saved on the server. */
  dirtyQuestionIds: string[];
  /** Monotonic local counter, surfaced to the server for telemetry only. */
  clientVersion: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";
