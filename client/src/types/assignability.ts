/**
 * Assignability report types (mirror of server/src/shared/test-assignability.util.ts).
 * Backend is the single source of truth; this keeps frontend typing strict.
 */

export type AssignabilityIssueReason =
  | "NO_ALLOWED_GRADES"
  | "NO_QUESTIONS"
  | "NO_SCORE"
  | "NO_CORRECT_ANSWER"
  | "INVALID_OPTIONS"
  | "NO_TOPIC_ASSIGNMENT"
  | "INTERACTIVE_ONLY_QUESTION"
  | "INVALID_INTERACTIVE_CONTENT";

export type AssignabilityIssue = {
  questionId?: string;
  reason: AssignabilityIssueReason;
};

export type AssignabilityReport = {
  /** Lze zadat žákům — interaktivní otázky (jen bleskovky) blokují. */
  isAssignable: boolean;
  /** Lze publikovat — validní interaktivní otázky neblokují. */
  isPublishable?: boolean;
  totalPoints: number;
  issues: AssignabilityIssue[];
};
