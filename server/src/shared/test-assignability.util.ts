/**
 * Single source of truth for test assignability.
 * Used by tests.service (findOne, assignTest, update publish) and assignments.service (create).
 */

export type AssignabilityIssueReason =
  | 'NO_ALLOWED_GRADES'
  | 'NO_QUESTIONS'
  | 'NO_SCORE'
  | 'NO_CORRECT_ANSWER'
  | 'INVALID_OPTIONS'
  | 'NO_TOPIC_ASSIGNMENT';

export type AssignabilityIssue = {
  questionId?: string;
  reason: AssignabilityIssueReason;
};

export type AssignabilityReport = {
  isAssignable: boolean;
  totalPoints: number;
  issues: AssignabilityIssue[];
  reasons: {
    missingAllowedGrades: number;
    missingQuestions: number;
    missingCorrectAnswers: number;
    invalidOptions: number;
    zeroPoints: number;
    noTopicAssignments: number;
  };
};

type QuestionInput = {
  id: string;
  type: string;
  correctAnswer: string | null;
  correctAnswers: string[] | null;
  score: number;
  options?: Array<{ text: string }> | null;
};

function normalizeText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizedOptionTexts(
  options?: Array<{ text: string }> | null,
): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => normalizeText(option.text))
    .filter((text): text is string => text !== null);
}

function normalizedAnswerList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeText(value))
    .filter((value): value is string => value !== null);
}

export function computeAssignability(
  questions: QuestionInput[],
  allowedGrades: string[],
): AssignabilityReport {
  const issues: AssignabilityIssue[] = [];
  const reasons = {
    missingAllowedGrades: 0,
    missingQuestions: 0,
    missingCorrectAnswers: 0,
    invalidOptions: 0,
    zeroPoints: 0,
    noTopicAssignments: 0,
  };

  if (allowedGrades.length === 0) {
    reasons.missingAllowedGrades = 1;
    issues.push({ reason: 'NO_ALLOWED_GRADES' });
  }

  if (questions.length === 0) {
    reasons.missingQuestions = 1;
    issues.push({ reason: 'NO_QUESTIONS' });
  }

  let totalPoints = 0;

  for (const q of questions) {
    const score = q.score ?? 0;
    totalPoints += score;

    if (score <= 0) {
      reasons.zeroPoints += 1;
      issues.push({ questionId: q.id, reason: 'NO_SCORE' });
    }

    const answer = normalizeText(q.correctAnswer);

    if (q.type === 'MULTIPLE_CHOICE') {
      const optionTexts = normalizedOptionTexts(q.options);
      if (optionTexts.length < 2) {
        reasons.invalidOptions += 1;
        issues.push({ questionId: q.id, reason: 'INVALID_OPTIONS' });
      }

      const answerList = normalizedAnswerList(q.correctAnswers);
      if (!answer || answerList.length > 0) {
        reasons.missingCorrectAnswers += 1;
        issues.push({ questionId: q.id, reason: 'NO_CORRECT_ANSWER' });
      } else {
        const normalizedAnswer = answer.toLowerCase();
        const matches = optionTexts.filter(
          (optionText) => optionText.toLowerCase() === normalizedAnswer,
        ).length;
        if (matches !== 1) {
          reasons.invalidOptions += 1;
          issues.push({ questionId: q.id, reason: 'INVALID_OPTIONS' });
        }
      }
      continue;
    }

    if (!answer) {
      reasons.missingCorrectAnswers += 1;
      issues.push({ questionId: q.id, reason: 'NO_CORRECT_ANSWER' });
    }
  }

  const isAssignable =
    reasons.missingAllowedGrades === 0 &&
    reasons.missingQuestions === 0 &&
    reasons.zeroPoints === 0 &&
    reasons.missingCorrectAnswers === 0 &&
    reasons.invalidOptions === 0 &&
    totalPoints > 0;

  return {
    isAssignable,
    totalPoints,
    issues,
    reasons,
  };
}
