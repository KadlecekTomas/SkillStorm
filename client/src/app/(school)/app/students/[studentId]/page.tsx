"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useStudentDetail } from "@/hooks/use-student-detail";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { withGuard } from "@/lib/guard/withGuard";
import { cn } from "@/utils/cn";

function ScoreBar({ score }: { score: number }): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct < 50
      ? "bg-red-500"
      : pct < 70
        ? "bg-amber-500"
        : "bg-green-500";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn(
          "w-12 shrink-0 text-right text-sm font-medium",
          pct < 50 ? "text-red-600" : pct < 70 ? "text-amber-600" : "text-green-600",
        )}
      >
        {pct.toFixed(0)} %
      </span>
    </div>
  );
}

function YearSelector({
  years,
  selectedYearId,
  activeYearId,
  onChange,
}: {
  years: { id: string; name: string }[];
  selectedYearId: string | null;
  activeYearId: string | null;
  onChange: (yearId: string) => void;
}): React.JSX.Element {
  return (
    <div className="relative inline-flex items-center gap-1.5">
      <label className="text-xs text-slate-500 font-medium" htmlFor="year-select">
        Školní rok:
      </label>
      <div className="relative">
        <select
          id="year-select"
          value={selectedYearId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}{y.id === activeYearId ? " (aktivní)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function StudentDetailPageContent(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const studentId = typeof params.studentId === "string" ? params.studentId : null;

  const { years, activeYear, bootstrapState } = useAcademicYears({ enabled: true });
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  // Default to active year once years are loaded
  const effectiveYearId = selectedYearId ?? activeYear?.id ?? null;

  const { detail, loading, error } = useStudentDetail(studentId, effectiveYearId);

  const handleBack = () => router.back();

  if (!studentId) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Neplatné ID žáka.</p>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Zpět
        </button>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Žák nenalezen.</p>
      </div>
    );
  }

  const { displayName, classroomLabel, performanceSummary, progressByTopic, recentTests } = detail;
  const avg = performanceSummary.averageScore;

  const sortedTopics = [...progressByTopic].sort((a, b) => a.averageScore - b.averageScore);

  const yearSelectorReady = bootstrapState === "READY" && years.length > 0;

  return (
    <div className="space-y-6 p-6">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Zpět
      </button>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{displayName}</h1>
          <p className="mt-0.5 text-sm text-slate-600">Třída: {classroomLabel}</p>
        </div>
        {yearSelectorReady && (
          <YearSelector
            years={years.map((y) => ({ id: y.id, name: y.name }))}
            selectedYearId={effectiveYearId}
            activeYearId={activeYear?.id ?? null}
            onChange={setSelectedYearId}
          />
        )}
      </header>

      {/* Performance summary */}
      <Card className="rounded-xl p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">Přehled výkonu</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Průměrné skóre</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{avg.toFixed(0)} %</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full",
                  avg < 50 ? "bg-red-500" : avg < 70 ? "bg-amber-500" : "bg-green-500",
                )}
                style={{ width: `${Math.min(100, avg)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500">Dokončené testy</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {performanceSummary.completedTests}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Poslední aktivita</p>
            <p className="mt-1 text-base font-medium text-slate-900">
              {performanceSummary.lastActivityAt
                ? new Date(performanceSummary.lastActivityAt).toLocaleDateString("cs-CZ")
                : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Progress by topic — horizontal bars, sorted weakest first */}
      {sortedTopics.length > 0 && (
        <Card className="rounded-xl p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Výkon podle témat</h2>
          <div className="space-y-3">
            {sortedTopics.map((t) => (
              <div key={t.topicId} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="mb-1 truncate text-sm text-slate-700">{t.topicName}</p>
                  <ScoreBar score={t.averageScore} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent tests */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Nedávné testy</h2>
        {recentTests.length > 0 ? (
          <Card className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-3 font-medium">Test</th>
                  <th className="px-4 py-3 font-medium">Skóre</th>
                  <th className="px-4 py-3 font-medium">Odevzdáno</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.map((t) => {
                  const pct =
                    t.score != null && t.maxScore != null && t.maxScore > 0
                      ? (t.score / t.maxScore) * 100
                      : null;
                  return (
                    <tr key={`${t.testId}-${t.submittedAt ?? ""}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">{t.title}</td>
                      <td className="px-4 py-3">
                        {pct != null ? (
                          <span
                            className={cn(
                              "font-medium",
                              pct < 50 ? "text-red-600" : pct < 70 ? "text-amber-600" : "text-green-600",
                            )}
                          >
                            {t.score} / {t.maxScore} ({pct.toFixed(0)} %)
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.submittedAt
                          ? new Date(t.submittedAt).toLocaleDateString("cs-CZ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card className="rounded-xl p-6 text-center text-slate-500">
            Zatím žádné odevzdané testy v tomto školním roce.
          </Card>
        )}
      </section>
    </div>
  );
}

function StudentDetailPage(): React.JSX.Element {
  return <StudentDetailPageContent />;
}

export default withGuard({ requireSchoolWorkspace: true })(StudentDetailPage);
