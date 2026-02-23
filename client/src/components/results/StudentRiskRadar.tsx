"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { ExternalLink } from "lucide-react";
import {
  calculateStudentRisk,
  getClassStats,
  getPrimaryDriver,
  PRIMARY_DRIVER_LABELS,
  type RiskLevel,
  type StudentRiskResult,
} from "@/utils/risk-engine";

export type StudentRiskRow = {
  id: string;
  name: string;
  overallPercent: number;
  worstTopic: string | null;
  /** Optional worst-topic success rate for risk scoring. */
  worstTopicPercent?: number | null;
  trend: "up" | "down" | "same";
  /** Optional numeric trend in percent points (e.g. -15). */
  trendPercent?: number | null;
  attempts: number;
  profileHref?: string | null;
};

export type { RiskLevel };

const RISK_THRESHOLD = 60;

type StudentRiskRadarProps = {
  students: StudentRiskRow[];
};

function getStudentRisk(
  s: StudentRiskRow,
  classAverageAttempts: number,
  classStats: { classAveragePercent: number; classStdDeviation: number },
): StudentRiskResult {
  return calculateStudentRisk({
    overallPercent: s.overallPercent,
    ...(s.trendPercent != null && { trendPercent: s.trendPercent }),
    trend: s.trend,
    attempts: s.attempts,
    ...(classAverageAttempts > 0 && { classAverageAttempts }),
    ...(s.worstTopicPercent != null && { weakTopicPercent: s.worstTopicPercent }),
    ...(s.worstTopic != null && { weakTopicName: s.worstTopic }),
    classAveragePercent: classStats.classAveragePercent,
    ...(classStats.classStdDeviation > 0 && {
      classStdDeviation: classStats.classStdDeviation,
    }),
  });
}

function trendLabel(trend: "up" | "down" | "same"): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "—";
}

function riskDotColor(level: RiskLevel): string {
  if (level === "HIGH") return "bg-red-500";
  if (level === "MEDIUM") return "bg-amber-500";
  return "bg-emerald-500";
}

function riskLabel(level: RiskLevel): string {
  if (level === "HIGH") return "Vysoké";
  if (level === "MEDIUM") return "Střední";
  return "Nízké";
}

export function StudentRiskRadar({ students }: StudentRiskRadarProps): React.JSX.Element {
  const classAverageAttempts =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.attempts, 0) / students.length
      : 0;
  const classStats = getClassStats(students.map((s) => s.overallPercent));

  const withScores = students.map((s) => ({
    student: s,
    risk: getStudentRisk(s, classAverageAttempts, classStats),
  }));
  const sorted = [...withScores].sort((a, b) => b.risk.score - a.risk.score);

  return (
    <section aria-label="Žáci v riziku">
      <Card className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Přehled žáků</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                <th className="w-10 px-4 py-3" aria-label="Riziko" />
                <th className="px-4 py-3">Žák</th>
                <th className="px-4 py-3 text-right">Celková %</th>
                <th className="px-4 py-3">Nejslabší téma</th>
                <th className="px-4 py-3 text-right">Trend</th>
                <th className="px-4 py-3 text-right">Pokusy</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(({ student: s, risk }) => {
                const primary = getPrimaryDriver(risk.components);
                const primaryLine =
                  primary != null ? `Hlavní faktor: ${PRIMARY_DRIVER_LABELS[primary]}` : null;
                const tooltip = [
                  `${riskLabel(risk.level)} (skóre ${risk.score})`,
                  primaryLine,
                  ...(risk.reasons.length > 0 ? risk.reasons : []),
                ]
                  .filter(Boolean)
                  .join("\n");
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      "text-slate-700",
                      s.overallPercent < RISK_THRESHOLD && "bg-red-50/50",
                    )}
                  >
                    <td className="px-4 py-3" title={tooltip}>
                      <span
                        className={cn("inline-block h-2.5 w-2.5 rounded-full", riskDotColor(risk.level))}
                        aria-hidden
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          s.overallPercent >= 80 && "text-emerald-600",
                          s.overallPercent >= 60 && s.overallPercent < 80 && "text-amber-600",
                          s.overallPercent < 60 && "text-red-600",
                        )}
                      >
                        {Math.round(s.overallPercent)} %
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.worstTopic ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {trendLabel(s.trend)}
                    </td>
                    <td className="px-4 py-3 text-right">{s.attempts}</td>
                    <td className="px-4 py-3">
                      {s.profileHref && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={s.profileHref} className="text-emerald-600">
                            Profil
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!students.length && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Zatím žádná data o žácích.
          </div>
        )}
      </Card>
    </section>
  );
}
