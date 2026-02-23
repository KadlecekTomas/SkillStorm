/**
 * Deterministic risk scoring for teacher diagnostics.
 * Converts scattered conditions into structured components and a weighted score.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type StudentRiskComponents = {
  performance: number;
  deviation: number;
  trend: number;
  topic: number;
  effort: number;
};

/** Weights applied to each component for final score. Defaults all 1. Tune for future calibration. */
export type StudentRiskWeightsConfig = {
  performance?: number;
  deviation?: number;
  trend?: number;
  topic?: number;
  effort?: number;
};

const DEFAULT_WEIGHTS: Required<StudentRiskWeightsConfig> = {
  performance: 1,
  deviation: 1,
  trend: 1,
  topic: 1,
  effort: 1,
};

export type StudentRiskInput = {
  overallPercent: number;
  /** Numeric trend in percent points (e.g. -15 for decline). If missing, derived from trend. */
  trendPercent?: number | null;
  trend?: "up" | "down" | "same";
  attempts: number;
  /** Class average attempts; if provided, above-average attempts add risk. */
  classAverageAttempts?: number | null;
  /** Worst topic success rate; if &lt; 50% adds risk. */
  weakTopicPercent?: number | null;
  weakTopicName?: string | null;
  /** Class average success %; used with classStdDeviation for relative deviation. */
  classAveragePercent?: number | null;
  /** Class standard deviation of success %; if missing, relative deviation is not applied. */
  classStdDeviation?: number | null;
};

export type StudentRiskResult = {
  score: number;
  level: RiskLevel;
  components: StudentRiskComponents;
  reasons: string[];
};

export type PrimaryDriverKey = keyof StudentRiskComponents;

export type TopicRiskInput = {
  id: string;
  name: string;
  successRate: number;
  /** Numeric trend in percent points (negative = worsening). */
  trendPercent?: number | null;
  trend?: "up" | "down" | "same";
  /** Share of this topic in total mistakes (0–100). Higher share = more impact. */
  shareOfMistakes?: number | null;
};

export type TopicRiskResult = {
  score: number;
  level: RiskLevel;
  reasons: string[];
};

/** Level bands: LOW 0–34, MEDIUM 35–64, HIGH 65+ */
const LEVEL_THRESHOLDS = { LOW: 35, MEDIUM: 65 } as const;

function scoreToLevel(score: number): RiskLevel {
  if (score < LEVEL_THRESHOLDS.LOW) return "LOW";
  if (score < LEVEL_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "HIGH";
}

/** Max raw points per component (before weighting). */
const COMPONENT_CAPS = {
  performance: 40,
  deviation: 35,
  trend: 30,
  topic: 20,
  effort: 10,
} as const;

function resolveTrendPercent(
  trendPercent: number | null | undefined,
  trend: "up" | "down" | "same" | undefined,
): number {
  if (trendPercent != null) return trendPercent;
  if (trend === "down") return -15;
  if (trend === "up") return 5;
  return 0;
}

/**
 * Compute raw component values (performance, deviation, trend, topic, effort).
 * Deterministic: when classStdDeviation is missing, deviation = 0.
 */
function computeStudentComponents(
  student: StudentRiskInput,
): { components: StudentRiskComponents; reasons: string[] } {
  let performance = 0;
  let deviation = 0;
  let trend = 0;
  let topic = 0;
  let effort = 0;
  const reasons: string[] = [];

  const classAvgPct = student.classAveragePercent ?? null;
  const stdDev = student.classStdDeviation ?? null;
  const useRelative =
    classAvgPct != null &&
    stdDev != null &&
    Number.isFinite(stdDev) &&
    stdDev > 0;

  if (useRelative) {
    const threshold1 = classAvgPct - 1 * stdDev;
    const threshold2 = classAvgPct - 2 * stdDev;
    if (student.overallPercent < threshold2) {
      deviation = Math.min(COMPONENT_CAPS.deviation, 35);
      reasons.push("Extrémně pod průměrem třídy");
    } else if (student.overallPercent < threshold1) {
      deviation = Math.min(COMPONENT_CAPS.deviation, 20);
      reasons.push("Výrazně pod průměrem třídy");
    }
  }

  if (student.overallPercent < 60) {
    performance = Math.min(COMPONENT_CAPS.performance, 40);
    reasons.push("Nízká celková úspěšnost");
  } else if (student.overallPercent < 70) {
    performance = Math.min(COMPONENT_CAPS.performance, 20);
    reasons.push("Celková úspěšnost pod doporučenou úrovní");
  }

  const trendPct = resolveTrendPercent(student.trendPercent, student.trend);
  if (trendPct <= -15) {
    trend = Math.min(COMPONENT_CAPS.trend, 30);
    reasons.push("Rychlé zhoršování");
  } else if (trendPct <= -10) {
    trend = Math.min(COMPONENT_CAPS.trend, 15);
    reasons.push("Mírné zhoršování");
  }

  const classAvg = student.classAverageAttempts ?? null;
  if (classAvg != null && student.attempts > classAvg) {
    effort = Math.min(COMPONENT_CAPS.effort, 10);
    reasons.push("Nadprůměrný počet pokusů při nízkém výkonu");
  }

  const weakPct = student.weakTopicPercent ?? null;
  const weakName = student.weakTopicName ?? null;
  if (weakPct != null && weakPct < 50) {
    topic = Math.min(COMPONENT_CAPS.topic, 20);
    reasons.push(
      weakName ? `Slabé zvládnutí tématu ${weakName}` : "Slabé zvládnutí nejslabšího tématu",
    );
  }

  return {
    components: { performance, deviation, trend, topic, effort },
    reasons,
  };
}

/**
 * Weighted sum of components, capped at 100. Uses config for future tuning; defaults all 1.
 */
function weightedScore(
  components: StudentRiskComponents,
  weights: StudentRiskWeightsConfig = {},
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const raw =
    w.performance * components.performance +
    w.deviation * components.deviation +
    w.trend * components.trend +
    w.topic * components.topic +
    w.effort * components.effort;
  return Math.min(100, raw);
}

/**
 * Returns the component key with the largest raw value (primary driver).
 * Ties: first in order performance, deviation, trend, topic, effort.
 */
export function getPrimaryDriver(components: StudentRiskComponents): PrimaryDriverKey | null {
  const keys: PrimaryDriverKey[] = ["performance", "deviation", "trend", "topic", "effort"];
  let maxKey: PrimaryDriverKey | null = null;
  let maxVal = 0;
  for (const key of keys) {
    const v = components[key];
    if (v > maxVal) {
      maxVal = v;
      maxKey = key;
    }
  }
  return maxKey;
}

/** Human-readable label for primary driver key. */
export const PRIMARY_DRIVER_LABELS: Record<PrimaryDriverKey, string> = {
  performance: "Celková úspěšnost",
  deviation: "Odchylka od třídy",
  trend: "Trend",
  topic: "Slabé téma",
  effort: "Počet pokusů",
};

/**
 * Hybrid scoring: structured components + weighted sum.
 * Final score = min(100, weighted sum). Deterministic when classStdDeviation is missing.
 */
export function calculateStudentRisk(
  student: StudentRiskInput,
  weightsConfig?: StudentRiskWeightsConfig,
): StudentRiskResult {
  const { components, reasons } = computeStudentComponents(student);
  const score = weightedScore(components, weightsConfig ?? {});

  return {
    score,
    level: scoreToLevel(score),
    components,
    reasons,
  };
}

/**
 * Calculate a 0–100 risk score for a topic.
 * Higher score = higher priority for intervention.
 */
export function calculateTopicRisk(topic: TopicRiskInput): TopicRiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (topic.successRate < 50) {
    score += 40;
    reasons.push("Nízká úspěšnost tématu");
  } else if (topic.successRate < 60) {
    score += 25;
    reasons.push("Podprůměrná úspěšnost tématu");
  } else if (topic.successRate < 70) {
    score += 10;
    reasons.push("Mírně snížená úspěšnost");
  }

  const trendPct = resolveTrendPercent(topic.trendPercent, topic.trend);
  if (trendPct <= -15) {
    score += 30;
    reasons.push("Rychlé zhoršování v tématu");
  } else if (trendPct <= -10) {
    score += 15;
    reasons.push("Zhoršování v tématu");
  }

  if (topic.shareOfMistakes != null && topic.shareOfMistakes > 30) {
    score += 15;
    reasons.push("Vysoký podíl chyb v celkové statistice");
  }

  score = Math.min(100, score);

  return {
    score,
    level: scoreToLevel(score),
    reasons,
  };
}

/**
 * Compute class average and standard deviation from a list of overall-percent values.
 * Used to pass classAveragePercent and classStdDeviation into calculateStudentRisk.
 * When n < 2, stdDeviation is 0 (relative deviation will not be applied).
 */
export function getClassStats(overallPercents: number[]): {
  classAveragePercent: number;
  classStdDeviation: number;
} {
  const n = overallPercents.length;
  if (n === 0) {
    return { classAveragePercent: 0, classStdDeviation: 0 };
  }
  const sum = overallPercents.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  if (n < 2) {
    return { classAveragePercent: mean, classStdDeviation: 0 };
  }
  const variance =
    overallPercents.reduce((acc, p) => acc + (p - mean) ** 2, 0) / n;
  return {
    classAveragePercent: mean,
    classStdDeviation: Math.sqrt(variance),
  };
}

export { LEVEL_THRESHOLDS, COMPONENT_CAPS, DEFAULT_WEIGHTS };
