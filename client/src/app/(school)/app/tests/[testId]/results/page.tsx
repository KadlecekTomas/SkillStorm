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
  submittedAt: string | null;
  attemptNo: number;
  student?: { name?: string | null };
  isAnonymous?: boolean;
};

function TestResultsPage(): React.JSX.Element {
  const { testId } = useParams<{ testId: string }>();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth<ResultRow[]>("GET", `/tests/${testId}/results`)
      .then((data) => {
        if (cancelled) return;
        setResults(Array.isArray(data) ? data : []);
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
      {error && <ErrorAlert title="Chyba" description={error} />}
      <div className="grid gap-3">
        {results.map((r) => (
          <Card key={r.id} className="p-4">
            <p className="font-semibold">
              {r.isAnonymous ? "Anonymizovaný uživatel" : r.student?.name ?? "Student"}
            </p>
            <p className="text-sm text-slate-600">
              Score: {r.score !== null ? Math.round((r.score ?? 0) * 100) + "%" : "n/a"}
            </p>
            <p className="text-sm text-slate-600">Attempt: {r.attemptNo}</p>
            <p className="text-sm text-slate-600">
              Submitted: {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "neodevzdáno"}
            </p>
          </Card>
        ))}
        {!results.length && <Card className="p-4 text-sm text-slate-600">Zatím žádné výsledky.</Card>}
      </div>
    </div>
  );
}

export default withGuard({ requireSchoolWorkspace: true })(TestResultsPage);
