/**
 * Determinism: same (questions, responses) → same score every time.
 * No DB, no random, no time — pure function.
 */
import { QuestionType } from '@prisma/client';
import {
  computeScore,
  type QuestionForScoring,
  type ResponseForScoring,
} from './submission-scoring';

const questions: QuestionForScoring[] = [
  {
    id: 'q1',
    type: QuestionType.TRUE_FALSE,
    correctAnswer: 'true',
    correctAnswers: null,
    score: 1,
  },
  {
    id: 'q2',
    type: QuestionType.FILL_IN_THE_BLANK,
    correctAnswer: 'Prague',
    correctAnswers: null,
    score: 2,
  },
  {
    id: 'q3',
    type: QuestionType.MULTIPLE_CHOICE,
    correctAnswer: 'B',
    correctAnswers: null,
    score: 1,
  },
];

const responses: ResponseForScoring[] = [
  { id: 'r1', questionId: 'q1', givenText: 'true' },
  { id: 'r2', questionId: 'q2', givenText: 'prague' },
  { id: 'r3', questionId: 'q3', givenText: 'B' },
];

describe('submission-scoring (determinism)', () => {
  it('same inputs produce identical score across 1000 runs', () => {
    const first = computeScore(questions, responses);
    expect(first.unscorableQuestionIds).toHaveLength(0);
    expect(first.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(first.normalizedScore).toBeLessThanOrEqual(1);

    for (let i = 0; i < 1000; i++) {
      const result = computeScore(questions, responses);
      expect(result.normalizedScore).toBe(first.normalizedScore);
      expect(result.total).toBe(first.total);
      expect(result.maxScore).toBe(first.maxScore);
      expect(result.results.length).toBe(first.results.length);
    }
  });

  it('normalized score is rounded to fixed decimal places (no float drift)', () => {
    const q = [
      {
        id: 'q1',
        type: QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        correctAnswers: null,
        score: 3,
      },
    ];
    const r = [{ id: 'r1', questionId: 'q1', givenText: 'true' }];
    const result = computeScore(q, r);
    expect(result.normalizedScore).toBe(1);
    const decimals = String(result.normalizedScore).split('.')[1] ?? '';
    expect(decimals.length).toBeLessThanOrEqual(4);
  });

  it('unscorable questions are excluded from score', () => {
    const withUnscorable: QuestionForScoring[] = [
      ...questions,
      {
        id: 'q-no-answer',
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: null,
        correctAnswers: null,
        score: 1,
      },
    ];
    const result = computeScore(withUnscorable, responses);
    expect(result.unscorableQuestionIds).toContain('q-no-answer');
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
  });
});
