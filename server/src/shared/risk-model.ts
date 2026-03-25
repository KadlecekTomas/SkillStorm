/**
 * Single source of truth for risk calculation across the system.
 */

export type RiskInput = {
  averageScorePercent: number;
  daysSinceLastActivity: number;
  trendPercent: number;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskFlag = "LOW_AVERAGE" | "INACTIVE" | "DECLINING";

export const LOW_AVERAGE_THRESHOLD_PERCENT = 60;
export const INACTIVE_DAYS_THRESHOLD = 14;
export const DECLINING_TREND_THRESHOLD_PERCENT = -10;

export function getRiskFlags(input: RiskInput): RiskFlag[] {
  const riskFlags: RiskFlag[] = [];

  if (input.averageScorePercent < LOW_AVERAGE_THRESHOLD_PERCENT) {
    riskFlags.push("LOW_AVERAGE");
  }
  if (input.daysSinceLastActivity > INACTIVE_DAYS_THRESHOLD) {
    riskFlags.push("INACTIVE");
  }
  if (input.trendPercent <= DECLINING_TREND_THRESHOLD_PERCENT) {
    riskFlags.push("DECLINING");
  }

  return riskFlags;
}

export function calculateRiskLevel(input: RiskInput): RiskLevel {
  const flagCount = getRiskFlags(input).length;

  if (flagCount >= 2) return "HIGH";
  if (flagCount === 1) return "MEDIUM";
  return "LOW";
}
