"use client";

import { ResultsChart } from "@/components/charts/results-chart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { fetchWithAuth } from "@/lib/http/client";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

function ResultsPage(): React.JSX.Element {
  const [chartData, setChartData] = useState<{ label: string; teacher: number; student: number }[]>([]);
  const [insights, setInsights] = useState<{ id: string; label: string; value: string; trend: "up" | "down" }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { hasOrganization, org } = useAuth();

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth<unknown[]>("GET", "/tests")
      .then((data) => {
        if (cancelled) return;
        const dataArray = Array.isArray(data) ? data : [];
        const mapped = dataArray.map((_, idx) => ({
          label: `Test ${idx + 1}`,
          teacher: 0,
          student: 0,
        }));
        setChartData(mapped);
        setInsights([]);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Nelze načíst výsledky";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Results</h2>
          <p className="text-sm text-slate-500">
            Analytics synced with NestJS scoring engine, export ready.
          </p>
        </div>
        <Button
          className="rounded-2xl"
          disabled={!hasOrganization}
          title={hasOrganization ? undefined : "Vyžaduje školu"}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
      {!hasOrganization && (
        <Alert
          title="Osobní režim"
          description={
            <span>
              Týmové výsledky a exporty se aktivují po připojení ke škole.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/dashboard/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      )}

      <ResultsChart data={chartData} />

      {error && <Alert title="Chyba" description={error} variant="warning" />}
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <Card key={insight.id} className="space-y-2">
            <p className="text-sm text-slate-500">{insight.label}</p>
            <p className="text-3xl font-semibold text-slate-900">{insight.value}</p>
            <p className={insight.trend === "up" ? "text-emerald-600" : "text-red-500"}>
              {insight.trend === "up" ? "+4.2%" : "-1.8%"} last sprint
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default withGuard()(ResultsPage);
