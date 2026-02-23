"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { ChevronDown, ChevronRight } from "lucide-react";

export type TopicDetail = {
  strugglingStudents: string[];
  dominantErrors: string[];
  interventionLabel: string;
};

export type TopicRow = {
  id: string;
  name: string;
  successRate: number;
  trend: "up" | "down" | "same";
  mistakeCount: number;
  detail?: TopicDetail | null;
};

export type ErrorTypeRow = {
  id: string;
  label: string;
  percent: number;
  count: number;
  lastSeen: string | null;
  /** Trend in percent points (e.g. +18 for "rising 18%"). */
  trendPercent?: number | null;
};

type ProblemMapProps = {
  topics: TopicRow[];
  errorTypes: ErrorTypeRow[];
  /** Topic id to scroll to and expand on mount (e.g. from "View topic detail"). */
  expandedTopicId?: string | null;
  onExpandedTopicIdChange?: (id: string | null) => void;
};

function successRateColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

function trendText(trend: "up" | "down" | "same"): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "—";
}

function trendColor(trend: "up" | "down" | "same"): string {
  if (trend === "up") return "text-emerald-600";
  if (trend === "down") return "text-red-500";
  return "text-slate-400";
}

export function ProblemMap({
  topics,
  errorTypes,
  expandedTopicId = null,
  onExpandedTopicIdChange,
}: ProblemMapProps): React.JSX.Element {
  const toggleTopic = (id: string) => {
    onExpandedTopicIdChange?.(expandedTopicId === id ? null : id);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2" aria-label="Mapa problémů">
      <Card className="rounded-2xl border border-slate-100 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Výkon témat</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                <th className="w-8 pb-2 pr-0" aria-hidden />
                <th className="pb-2 pr-2">Téma</th>
                <th className="pb-2 pr-2 text-right">Úspěšnost</th>
                <th className="pb-2 pr-2 text-right">Trend</th>
                <th className="pb-2 text-right">Chyby</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topics.map((t) => {
                const isExpanded = expandedTopicId === t.id;
                const hasDetail = t.detail && (t.detail.strugglingStudents.length > 0 || t.detail.dominantErrors.length > 0 || t.detail.interventionLabel);
                return (
                  <React.Fragment key={t.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleTopic(t.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleTopic(t.id)}
                      className={cn(
                        "cursor-pointer text-slate-700 transition-colors hover:bg-slate-50/80",
                        isExpanded && "bg-slate-50",
                      )}
                      aria-expanded={isExpanded}
                    >
                      <td className="py-2 pr-0">
                        {hasDetail ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )
                        ) : (
                          <span className="w-4" />
                        )}
                      </td>
                      <td className="py-2 pr-2 font-medium">{t.name}</td>
                      <td className={cn("py-2 pr-2 text-right font-medium", successRateColor(t.successRate))}>
                        {Math.round(t.successRate)} %
                      </td>
                      <td className={cn("py-2 pr-2 text-right", trendColor(t.trend))}>
                        {trendText(t.trend)}
                      </td>
                      <td className="py-2 text-right">{t.mistakeCount}</td>
                    </tr>
                    {isExpanded && t.detail && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50/80 px-4 pb-3 pt-0">
                          <div className="rounded-lg border border-slate-100 bg-white p-3 text-sm">
                            {t.detail.strugglingStudents.length > 0 && (
                              <p className="mb-2">
                                <span className="font-medium text-slate-600">Nejvíce zápasí: </span>
                                {t.detail.strugglingStudents.join(", ")}
                              </p>
                            )}
                            {t.detail.dominantErrors.length > 0 && (
                              <p className="mb-2">
                                <span className="font-medium text-slate-600">Typy chyb: </span>
                                {t.detail.dominantErrors.join(", ")}
                              </p>
                            )}
                            {t.detail.interventionLabel && (
                              <p className="mb-0">
                                <span className="font-medium text-slate-600">Doporučení: </span>
                                {t.detail.interventionLabel}
                              </p>
                            )}
                            {!t.detail.strugglingStudents.length && !t.detail.dominantErrors.length && !t.detail.interventionLabel && (
                              <p className="text-slate-500">Pro toto téma zatím není detail.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!topics.length && (
            <p className="py-6 text-center text-sm text-slate-500">Zatím žádná data o tématech.</p>
          )}
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-100 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Typy chyb</h3>
        <div className="space-y-3">
          {errorTypes.map((e) => (
            <div key={e.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{e.label}</span>
                <span className="text-slate-500">
                  {Math.round(e.percent)} % · {e.count}×
                  {e.trendPercent != null && e.trendPercent > 0 && (
                    <span className="ml-1 text-amber-600">↑ +{Math.round(e.trendPercent)} %</span>
                  )}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, e.percent)}%` }}
                />
              </div>
              {e.lastSeen && (
                <p className="text-xs text-slate-400">Naposledy: {e.lastSeen}</p>
              )}
            </div>
          ))}
          {!errorTypes.length && (
            <p className="py-6 text-center text-sm text-slate-500">Zatím žádné typy chyb.</p>
          )}
        </div>
      </Card>
    </section>
  );
}
