/**
 * Single source of truth for student performance analytics.
 *
 * CONTRACT:
 *   averageScore       — 0–100 percentage, weighted: SUM(points) / SUM(maxPoints)
 *   completedTests     — COUNT(DISTINCT testId) using best attempt per test
 *   progressByTopic    — 0–100 percentage per topic, same best-attempt dataset
 *   recentTests        — all attempts newest-first (display only, NOT statistics)
 *   lastActivityAt     — most recent submittedAt in the provided dataset
 *
 * RULES:
 *   • "Best attempt" = highest score for a given (student, testId) pair.
 *   • All metrics except recentTests use the best-attempt dataset exclusively.
 *   • The caller is responsible for year-scoping before passing submissions here.
 *   • All inputs must belong to ONE student and ONE academic year.
 */

export type SubmissionForPerformance = {
  testId: string;
  title: string;
  earnedPoints: number | null;
  /** Sum of question scores for this test (raw points possible, e.g. 3.0). 0 if no scored questions. */
  maxPoints: number;
  submittedAt: Date | null;
  topicLevelId: string | null;
  topicName: string | null;
};

export type StudentPerformanceMetrics = {
  /** COUNT(DISTINCT testId) using best attempt per test. */
  completedTests: number;
  /** 0–100 weighted percentage: SUM(bestPoints) / SUM(maxPoints) * 100. */
  averageScore: number;
  /** Per-topic weighted percentages using best-attempt dataset. */
  progressByTopic: Array<{
    topicId: string;
    topicName: string;
    /** 0–100 weighted percentage. */
    averageScore: number;
  }>;
  /** All attempts newest-first for UI display only. Not used for statistics. */
  recentTests: Array<{
    testId: string;
    title: string;
    score: number | null;
    maxScore: number | null;
    submittedAt: string | null;
  }>;
  /** ISO string of the most recent submittedAt in the dataset. */
  lastActivityAt: string | null;
};

/**
 * Compute all student performance metrics from a unified submission dataset.
 * All submissions must be pre-filtered to the correct student and academic year.
 * Input must be sorted newest-first (determines recentTests order).
 */
export function computeStudentPerformance(
  submissions: SubmissionForPerformance[],
): StudentPerformanceMetrics {
  // ── 1. Best attempt per test: GROUP BY testId, MAX(score) ─────────────────
  const bestByTest = new Map<string, SubmissionForPerformance>();
  for (const s of submissions) {
    if (s.earnedPoints == null) continue;
    const existing = bestByTest.get(s.testId);
    if (!existing || s.earnedPoints > (existing.earnedPoints ?? -Infinity)) {
      bestByTest.set(s.testId, s);
    }
  }
  const bestAttempts = Array.from(bestByTest.values());

  // ── 2. Core stats from best-attempt dataset only ───────────────────────────
  const completedTests = bestAttempts.length;

  const totalPoints = bestAttempts.reduce(
    (sum, a) => sum + (a.earnedPoints ?? 0),
    0,
  );
  const totalMaxPoints = bestAttempts.reduce(
    (sum, a) => sum + a.maxPoints,
    0,
  );
  // averageScore in 0–100 range, rounded to 2 decimal places
  const averageScore =
    totalMaxPoints > 0
      ? Math.round((totalPoints / totalMaxPoints) * 10000) / 100
      : 0;

  // Defensive: warn if scored submissions exist but average resolved to 0
  if (submissions.some((s) => s.earnedPoints != null) && averageScore === 0) {
    console.warn(
      '[computeStudentPerformance] averageScore=0 despite scored submissions. ' +
        `completedTests=${completedTests}, totalPoints=${totalPoints}, ` +
        `totalMaxPoints=${totalMaxPoints}. ` +
        'Likely cause: all test questions have score=0. Check test configuration.',
    );
  }

  // ── 3. lastActivityAt — most recent submission in dataset ─────────────────
  const lastActivityAt =
    submissions.find((s) => s.submittedAt)?.submittedAt?.toISOString() ?? null;

  // ── 4. progressByTopic — group best attempts by topicLevel ────────────────
  const topicMap = new Map<
    string,
    { name: string; points: number; maxPoints: number }
  >();
  for (const attempt of bestAttempts) {
    if (!attempt.topicLevelId || !attempt.topicName) continue;
    const prev = topicMap.get(attempt.topicLevelId) ?? {
      name: attempt.topicName,
      points: 0,
      maxPoints: 0,
    };
    prev.points += attempt.earnedPoints ?? 0;
    prev.maxPoints += attempt.maxPoints;
    topicMap.set(attempt.topicLevelId, prev);
  }
  const progressByTopic = Array.from(topicMap.entries()).map(
    ([topicId, v]) => ({
      topicId,
      topicName: v.name,
      averageScore:
        v.maxPoints > 0
          ? Math.round((v.points / v.maxPoints) * 10000) / 100
          : 0,
    }),
  );

  // ── 5. recentTests — all attempts for UI display (newest first, max 10) ───
  const recentTests = submissions.slice(0, 10).map((s) => ({
    testId: s.testId,
    title: s.title,
    score: s.earnedPoints,
    maxScore: s.maxPoints > 0 ? s.maxPoints : null,
    submittedAt: s.submittedAt?.toISOString() ?? null,
  }));

  return {
    completedTests,
    averageScore,
    progressByTopic,
    recentTests,
    lastActivityAt,
  };
}
