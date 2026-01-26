"use client";

import { useEffect, useState } from "react";
import { TestCard } from "@/components/cards/test-card";
import { DataTable, type Column } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TestSummary } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

const columns: Column<TestSummary>[] = [
  { key: "title", label: "Test" },
  { key: "subject", label: "Subject" },
  {
    key: "avgScore",
    label: "Avg Score",
    render: (row) => `${row.avgScore}%`,
  },
  {
    key: "completionRate",
    label: "Completion",
    render: (row) => `${row.completionRate}%`,
  },
  { key: "submissions", label: "Submissions" },
];

function TestsPage(): React.JSX.Element {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasOrganization, org } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const fetchTests = async () => {
      try {
        const data = await fetchWithAuth<TestSummary[]>("GET", "/tests");
        if (cancelled) return;
        // Ensure data is an array
        setTests(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch tests:", error);
        setTests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTests();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Assessments</h2>
          <p className="text-sm text-slate-500">
            Monitor performance, drafts and published tests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">NOT IMPLEMENTED</Badge>
          <Button
            disabled
            title="Vytváření testů přes UI není implementované."
          >
            New test
          </Button>
        </div>
      </div>
      <Alert
        title="Not implemented"
        description="Vytváření testů přes UI není implementované. Použij API nebo seed."
        variant="warning"
      />
      {!hasOrganization && (
        <Alert
          title="Osobní režim"
          description={
            <span>
              Některé týmové funkce (publikování, třídy, sdílení) vyžadují školu.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/dashboard/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      )}
      {!loading && tests.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.slice(0, 3).map((test) => (
            <TestCard key={test.id} test={test} />
          ))}
        </div>
      )}
      {loading ? (
        <LoadingSpinner label="Loading tests" />
      ) : (
        <DataTable data={tests} columns={columns} loading={loading} />
      )}
    </div>
  );
}

export default withGuard()(TestsPage);
