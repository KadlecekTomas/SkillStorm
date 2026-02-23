"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TestCard } from "@/components/cards/test-card";
import { OverviewCard } from "@/components/cards/overview-card";
import { httpClient } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import {
  getDashboardOverview,
  type StatsOverviewResponse,
} from "@/lib/api/dashboard";
import { BookOpenCheck, NotebookTabs, Users2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";

const EMPTY_OVERVIEW = "V aktuálním školním roce zatím neproběhla žádná aktivita.";
const EMPTY_TESTS = "Žádná aktivita v aktuálním školním roce.";

export function DirectorDashboard(): React.JSX.Element {
  const router = useRouter();
  const { can } = usePermissions();
  const canManageTests = can(PermissionKey.CREATE_TEST) || can(PermissionKey.EDIT_TEST);
  const canSeeResults = can(PermissionKey.VIEW_RESULTS);

  const [overviewData, setOverviewData] = useState<StatsOverviewResponse | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [testsLoading, setTestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canSeeResults) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardOverview("evaluated")
      .then((res) => {
        if (!cancelled) setOverviewData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepodařilo se načíst data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeResults]);

  useEffect(() => {
    if (!canManageTests) {
      setTestsLoading(false);
      return;
    }
    let cancelled = false;
    setTestsLoading(true);
    httpClient
      .get<TestSummary[]>("/tests")
      .then((data) => {
        if (!cancelled) setTests(Array.isArray(data) && data.length > 0 ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageTests]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <LoadingSpinner label="Načítání..." />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert title="Chyba načítání dat" description={error} variant="warning" />;
  }

  const hasActivity =
    overviewData &&
    (overviewData.totalSubmissions > 0 || overviewData.totalTests > 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          title="Celkem testů"
          value={String(overviewData?.totalTests ?? 0)}
          delta={`${overviewData?.counts.approved ?? 0} schváleno`}
          icon={<NotebookTabs className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          title="Odevzdání"
          value={String(overviewData?.totalSubmissions ?? 0)}
          delta={`${overviewData?.counts.pending ?? 0} čeká`}
          icon={<Users2 className="h-5 w-5" />}
        />
        <OverviewCard
          title="Úspěšnost"
          value={`${Math.round((overviewData?.passRate ?? 0) * 100)}%`}
          delta={
            overviewData?.avgScore != null
              ? `Průměr: ${Math.round(overviewData.avgScore)}%`
              : "Bez průměru"
          }
          icon={<BookOpenCheck className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {canManageTests && (
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Moje testy</p>
              <p className="text-lg font-semibold text-slate-900">Přehled a průměry</p>
            </div>
            {testsLoading ? (
              <LoadingSpinner label="Načítám testy" className="py-8" />
            ) : tests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tests.map((test) => (
                  <TestCard
                    key={test.id}
                    test={test}
                    onView={(testId) => router.push(`/dashboard/tests?test=${testId}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">{EMPTY_TESTS}</p>
            )}
          </Card>
        )}

        <Card className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Přehled školy</p>
            <p className="text-lg font-semibold text-slate-900">
              Aktivity v aktuálním roce
            </p>
          </div>
          {hasActivity ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>Celkem testů: {overviewData?.totalTests ?? 0}</p>
              <p>Odevzdání: {overviewData?.totalSubmissions ?? 0}</p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{EMPTY_OVERVIEW}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
