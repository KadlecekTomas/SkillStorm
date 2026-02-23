/**
 * Deterministic Early Warning risk logic. No AI/ML, no new DB.
 * Uses only submission scores and dates.
 */

export type RiskTrend = 'UP' | 'DOWN' | 'STABLE';
export type RiskLevel = 'NONE' | 'MEDIUM' | 'HIGH';
export type RiskFlag = 'LOW_AVERAGE' | 'INACTIVE' | 'DECLINING';

export type SubmissionInput = {
  score: number | null;
  submittedAt: Date | null;
};

const LOW_AVERAGE_THRESHOLD_PERCENT = 60;
const INACTIVE_DAYS_THRESHOLD = 14;
const DECLINE_THRESHOLD = 0.1; // 10% in normalized 0–1 score

export type StudentRiskInput = {
  displayName: string;
  submissions: SubmissionInput[];
  now?: Date;
};

export type StudentRiskResult = {
  averageScorePercent: number;
  lastActivityAt: string | null;
  trend: RiskTrend;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
};

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Pure function: compute risk for one student from their submissions.
 */
export function computeStudentRisk(input: StudentRiskInput): StudentRiskResult {
  const now = input.now ?? new Date();
  const withScore = input.submissions.filter(
    (s): s is SubmissionInput & { score: number } =>
      s.score != null && s.submittedAt != null,
  );
  const sorted = [...withScore].sort(
    (a, b) =>
      (b.submittedAt!.getTime() ?? 0) - (a.submittedAt!.getTime() ?? 0),
  );

  const totalScore = withScore.reduce((sum, s) => sum + s.score, 0);
  const count = withScore.length;
  const averageScorePercent =
    count > 0 ? (totalScore / count) * 100 : 0;

  const lastSubmission = sorted[0];
  const lastActivityAt = lastSubmission?.submittedAt?.toISOString() ?? null;
  const lastActivityDays = lastActivityAt
    ? daysBetween(now, new Date(lastActivityAt))
    : Infinity;

  let trend: RiskTrend = 'STABLE';
  if (sorted.length >= 3) {
    const last2 = sorted.slice(0, 2);
    const previous = sorted.slice(2);
    const last2Avg =
      last2.reduce((s, x) => s + x.score, 0) / last2.length;
    const previousAvg =
      previous.reduce((s, x) => s + x.score, 0) / previous.length;
    if (last2Avg < previousAvg - DECLINE_THRESHOLD) {
      trend = 'DOWN';
    } else if (last2Avg > previousAvg + DECLINE_THRESHOLD) {
      trend = 'UP';
    }
  }

  const isLowAverage = averageScorePercent < LOW_AVERAGE_THRESHOLD_PERCENT;
  const isInactive = lastActivityDays > INACTIVE_DAYS_THRESHOLD;
  const isDeclining = trend === 'DOWN';

  const riskFlags: RiskFlag[] = [];
  if (isLowAverage) riskFlags.push('LOW_AVERAGE');
  if (isInactive) riskFlags.push('INACTIVE');
  if (isDeclining) riskFlags.push('DECLINING');

  const flagCount = riskFlags.length;
  const riskLevel: RiskLevel =
    flagCount >= 2 ? 'HIGH' : flagCount === 1 ? 'MEDIUM' : 'NONE';

  return {
    averageScorePercent: Math.round(averageScorePercent * 100) / 100,
    lastActivityAt,
    trend,
    riskLevel,
    riskFlags,
  };
}
