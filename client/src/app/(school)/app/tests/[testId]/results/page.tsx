"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";

type ResultRow = {
  id: string;
  score: number | null;
  maxPoints?: number | null;
  percentage?: number | null;
  status: string;
  submittedAt: string | null;
  attemptNo: number;
  correctCount: number;
  incorrectCount: number;
  pendingCount: number;
  totalEvaluated: number;
  student?: { name?: string | null };
  isAnonymous?: boolean;
};

type ResultsResponse = {
  items: ResultRow[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

function TestResultsPage(): React.JSX.Element {
  const { testId } = useParams<{ testId: string }>();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth<ResultRow[] | ResultsResponse>("GET", `/tests/${testId}/results`)
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setResults(items);
        setTotal(Array.isArray(data) ? items.length : (data?.meta?.total ?? items.length));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Nelze načíst výsledky";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Výsledky testu</h1>
      {total !== null && (
        <p className="text-sm text-slate-500">Odevzdání celkem: {total}</p>
      )}
      {error && <ErrorAlert title="Chyba" description={error} />}
      <div className="grid gap-3">
        {results.map((r) => (
          <Card key={r.id} className="p-4">
            <p className="font-semibold">
              {r.isAnonymous ? "Anonymizovaný uživatel" : r.student?.name ?? "Student"}
            </p>
            <p className="text-sm text-slate-600">
              Score: {r.score !== null
                ? r.maxPoints != null && r.maxPoints > 0
                  ? `${r.score} / ${r.maxPoints} (${Math.round(r.percentage ?? (r.score / r.maxPoints) * 100)}%)`
                  : "n/a"
                : "n/a"}
            </p>
            <p className="text-sm text-slate-600">Stav: {r.status}</p>
            <p className="text-sm text-slate-600">Attempt: {r.attemptNo}</p>
            <p className="text-sm text-slate-600">
              Submitted: {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "neodevzdáno"}
            </p>
            <p className="text-sm text-slate-600">
              Správně: {r.correctCount} | Špatně: {r.incorrectCount} | Nevyhodnoceno: {r.pendingCount}
            </p>
          </Card>
        ))}
        {!results.length && <Card className="p-4 text-sm text-slate-600">Zatím žádné výsledky.</Card>}
      </div>
    </div>
  );
}

export default withGuard({ requireSchoolWorkspace: true })(TestResultsPage);
