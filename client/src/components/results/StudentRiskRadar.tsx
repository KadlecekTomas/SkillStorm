"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { ExternalLink } from "lucide-react";
import type { RiskOverviewStudent } from "@/hooks/use-classroom-risk-overview";

export type StudentRiskRow = {
  id: string;
  name: string;
  averageScorePercent: number;
  trend: RiskOverviewStudent["trend"];
  riskLevel: RiskOverviewStudent["riskLevel"];
  riskFlags: RiskOverviewStudent["riskFlags"];
  lastActivityAt: string | null;
  profileHref?: string | null;
};

export type RiskLevel = RiskOverviewStudent["riskLevel"];

type StudentRiskRadarProps = {
  students: StudentRiskRow[];
};
function trendLabel(trend: RiskOverviewStudent["trend"]): string {
  if (trend === "UP") return "↑";
  if (trend === "DOWN") return "↓";
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
  const severity = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const sorted = [...students].sort((a, b) => {
    if (severity[a.riskLevel] !== severity[b.riskLevel]) {
      return severity[a.riskLevel] - severity[b.riskLevel];
    }
    return a.averageScorePercent - b.averageScorePercent;
  });

  const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
    });
  };

  const flagLabel: Record<RiskOverviewStudent["riskFlags"][number], string> = {
    LOW_AVERAGE: "Nízký průměr",
    INACTIVE: "Neaktivita",
    DECLINING: "Klesající trend",
  };

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
                <th className="px-4 py-3 text-right">Průměr</th>
                <th className="px-4 py-3 text-right">Trend</th>
                <th className="px-4 py-3">Signály</th>
                <th className="px-4 py-3">Aktivita</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((s) => {
                const tooltip = [
                  `Riziko: ${riskLabel(s.riskLevel)}`,
                  ...s.riskFlags.map((flag) => flagLabel[flag]),
                ].join("\n");
                return (
                  <tr
                    key={s.id}
                    className="text-slate-700"
                  >
                    <td className="px-4 py-3" title={tooltip}>
                      <span
                        className={cn("inline-block h-2.5 w-2.5 rounded-full", riskDotColor(s.riskLevel))}
                        aria-hidden
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "font-medium",
                          s.averageScorePercent >= 80 && "text-emerald-600",
                          s.averageScorePercent >= 60 && s.averageScorePercent < 80 && "text-amber-600",
                          s.averageScorePercent < 60 && "text-red-600",
                        )}
                      >
                        {Math.round(s.averageScorePercent)} %
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {trendLabel(s.trend)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.riskFlags.length > 0
                        ? s.riskFlags.map((flag) => flagLabel[flag]).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.lastActivityAt)}</td>
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
