/**
 * Pure scoring: no DB, no random, no time.
 * Same (questions, responses) → same result. Rounding to fixed decimals for determinism.
 */
import { QuestionType } from '@prisma/client';

const SCORE_DECIMAL_PLACES = 4;

function roundScore(value: number): number {
  const factor = 10 ** SCORE_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

function normalizeText(s?: string | null): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function normalizeFitb(s?: string | null): string {
  return (s ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function normalizeAnswerList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) {
          return p.map((v) => String(v).trim()).filter((v) => v.length > 0);
        }
      } catch {
        return [];
      }
    }
  }
  return [];
}

export type QuestionForScoring = {
  id: string;
  type: QuestionType;
  correctAnswer: string | null;
  correctAnswers: unknown;
  score: number | null;
};

export type ResponseForScoring = {
  id: string;
  questionId: string;
  givenText: string;
};

export type ScoreResultItem = {
  questionId: string;
  responseId: string;
  correct: boolean | null;
  gained: number;
};

export type ComputeScoreResult = {
  total: number;
  maxScore: number;
  normalizedScore: number;
  results: ScoreResultItem[];
  unscorableQuestionIds: string[];
};

/**
 * Deterministic score from questions and responses. No I/O.
 */
export function computeScore(
  questions: QuestionForScoring[],
  responses: ResponseForScoring[],
): ComputeScoreResult {
  let total = 0;
  let maxScore = 0;
  const unscorableQuestionIds: string[] = [];
  const results: ScoreResultItem[] = [];

  for (const q of questions) {
    const resp = responses.find((r) => r.questionId === q.id);
    const given = resp?.givenText;

    let correct: boolean | null = false;
    let gained = 0;
    const qScore = q.score ?? 1;

    const correctAnswer = normalizeText(q.correctAnswer ?? null);
    const correctAnswers = normalizeAnswerList(q.correctAnswers ?? []);
    const hasSingle = !!correctAnswer;
    const hasMulti = correctAnswers.length > 0;

    let mode: 'single' | 'multi' | null = null;
    if (q.type === QuestionType.MULTIPLE_CHOICE) {
      if (hasSingle && hasMulti) mode = null;
      else if (hasMulti) mode = 'multi';
      else if (hasSingle) mode = 'single';
    } else if (
      q.type === QuestionType.TRUE_FALSE ||
      q.type === QuestionType.FILL_IN_THE_BLANK
    ) {
      mode = hasSingle ? 'single' : null;
    }

    if (!mode) {
      unscorableQuestionIds.push(q.id);
      results.push({
        questionId: q.id,
        responseId: resp?.id ?? '',
        correct: null,
        gained: 0,
      });
      continue;
    }

    maxScore += qScore;

    if (q.type === QuestionType.TRUE_FALSE) {
      correct =
        String(given ?? '').toLowerCase() ===
        String(correctAnswer ?? '').toLowerCase();
      gained = correct ? qScore : 0;
    } else if (q.type === QuestionType.FILL_IN_THE_BLANK) {
      correct =
        normalizeFitb(String(given)) === normalizeFitb(correctAnswer ?? '');
      gained = correct ? qScore : 0;
    } else if (q.type === QuestionType.MULTIPLE_CHOICE) {
      if (mode === 'multi') {
        const corr = [...correctAnswers].sort().join(',');
        const giv = normalizeAnswerList(given).sort().join(',');
        correct = corr === giv;
      } else {
        const givenSingle = Array.isArray(given) ? given[0] : given;
        correct = String(givenSingle ?? '') === String(correctAnswer ?? '');
      }
      gained = correct ? qScore : 0;
    }

    total += gained;
    results.push({
      questionId: q.id,
      responseId: resp?.id ?? '',
      correct,
      gained,
    });
  }

  const normalizedScore =
    maxScore > 0 ? roundScore(total / maxScore) : 0;

  return {
    total,
    maxScore,
    normalizedScore,
    results,
    unscorableQuestionIds,
  };
}
