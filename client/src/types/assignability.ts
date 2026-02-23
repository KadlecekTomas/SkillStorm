/**
 * Assignability report types (mirror of server/src/shared/test-assignability.util.ts).
 * Backend is the single source of truth; this keeps frontend typing strict.
 */

export type AssignabilityIssueReason =
  | "NO_QUESTIONS"
  | "NO_SCORE"
  | "NO_CORRECT_ANSWER";

export type AssignabilityIssue = {
  questionId?: string;
  reason: AssignabilityIssueReason;
};

export type AssignabilityReport = {
  isAssignable: boolean;
  totalPoints: number;
  issues: AssignabilityIssue[];
};
