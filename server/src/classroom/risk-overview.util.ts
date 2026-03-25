/**
 * Deterministic Early Warning risk logic. No AI/ML, no new DB.
 * Uses submission scores and dates to derive normalized student risk inputs.
 *
 * SCORE CONTRACT:
 *   - score (raw): points earned for a submission (e.g. 2 out of 3)
 *   - maxScore: sum of question scores for that test (e.g. 3.0)
 *   - averageScorePercent: SUM(score) / SUM(maxScore) * 100 (weighted, 0–100)
 *
 * Callers must pass maxScore per submission. Submissions with maxScore=0
 * are excluded from averageScorePercent (treated as unscored).
 */
import type { RiskFlag, RiskLevel } from '@/shared/risk-model';

export type RiskTrend = 'UP' | 'DOWN' | 'STABLE';

export type SubmissionInput = {
  score: number | null;
  submittedAt: Date | null;
  /** Sum of question scores for this test. 0 if the test has no scored questions. */
  maxScore: number;
};

const DECLINE_THRESHOLD_PCT = 10; // 10 percentage-point drop → DECLINING flag

export type StudentRiskInput = {
  displayName: string;
  submissions: SubmissionInput[];
  now?: Date;
};

export type StudentRiskMetrics = {
  averageScorePercent: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number;
  trend: RiskTrend;
  trendPercent: number;
};

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Convert a submission to its percentage score. Returns null if unscored or maxScore=0. */
function toPercent(s: SubmissionInput): number | null {
  if (s.score == null || s.maxScore <= 0) return null;
  return (s.score / s.maxScore) * 100;
}

/**
 * Pure function: derive normalized metrics for one student from their submissions.
 * All submissions must already be scoped to the relevant academic year.
 */
export function deriveStudentRiskMetrics(input: StudentRiskInput): StudentRiskMetrics {
  const now = input.now ?? new Date();

  // Only submissions with valid score and maxScore contribute to statistics
  const scored = input.submissions.filter(
    (s): s is SubmissionInput & { score: number } =>
      s.score != null && s.submittedAt != null && s.maxScore > 0,
  );

  // Sorted newest-first for trend detection
  const sorted = [...scored].sort(
    (a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime(),
  );

  // Weighted average: SUM(score) / SUM(maxScore) * 100
  const totalPoints = scored.reduce((sum, s) => sum + s.score, 0);
  const totalMaxPoints = scored.reduce((sum, s) => sum + s.maxScore, 0);
  const averageScorePercent =
    totalMaxPoints > 0 ? (totalPoints / totalMaxPoints) * 100 : 0;

  // lastActivityAt — most recent submitted submission
  const lastSubmission = sorted[0];
  const lastActivityAt = lastSubmission?.submittedAt?.toISOString() ?? null;
  const daysSinceLastActivity = lastActivityAt
    ? daysBetween(now, new Date(lastActivityAt))
    : Infinity;

  // Trend: compare newest 2 vs all prior, in percentage space (not raw points)
  let trend: RiskTrend = 'STABLE';
  let trendPercent = 0;
  if (sorted.length >= 3) {
    const last2 = sorted.slice(0, 2);
    const previous = sorted.slice(2);
    const last2Pcts = last2
      .map(toPercent)
      .filter((p): p is number => p != null);
    const prevPcts = previous
      .map(toPercent)
      .filter((p): p is number => p != null);
    if (last2Pcts.length > 0 && prevPcts.length > 0) {
      const last2Avg =
        last2Pcts.reduce((s, x) => s + x, 0) / last2Pcts.length;
      const prevAvg = prevPcts.reduce((s, x) => s + x, 0) / prevPcts.length;
      trendPercent = Math.round((last2Avg - prevAvg) * 100) / 100;
      if (last2Avg < prevAvg - DECLINE_THRESHOLD_PCT) {
        trend = 'DOWN';
      } else if (last2Avg > prevAvg + DECLINE_THRESHOLD_PCT) {
        trend = 'UP';
      }
    }
  }

  return {
    averageScorePercent: Math.round(averageScorePercent * 100) / 100,
    lastActivityAt,
    daysSinceLastActivity,
    trend,
    trendPercent,
  };
}

export type { RiskFlag, RiskLevel };
