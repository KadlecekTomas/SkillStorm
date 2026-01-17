"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OverviewCard } from "@/components/cards/overview-card";
import { TestCard } from "@/components/cards/test-card";
import { Card } from "@/components/ui/card";
import { httpClient } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import { BookOpenCheck, NotebookTabs, Users2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";
import { PermissionGate } from "@/components/access/permission-gate";
import { RestrictedView } from "@/components/access/restricted-view";
import { useGamification } from "@/hooks/use-gamification";
import { GamificationPanel } from "@/components/gamification/gamification-panel";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { withGuard } from "@/lib/guard/withGuard";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function DashboardPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const { can } = usePermissions();
  const { summary: gamification } = useGamification();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  const canSeeTests = can(PermissionKey.VIEW_RESULTS);

  useEffect(() => {
    if (gamification?.level && previousLevelRef.current !== null) {
      if (gamification.level > previousLevelRef.current) {
        setLevelModalOpen(true);
      }
    }
    if (gamification?.level !== undefined) {
      previousLevelRef.current = gamification.level ?? null;
    }
  }, [gamification]);
  useEffect(() => {
    let cancelled = false;
    if (!canSeeTests) {
      setTestsLoading(false);
      return;
    }
    setTestsLoading(true);
    httpClient
      .get<TestSummary[]>("/tests")
      .then((data) => {
        if (cancelled) return;
        // Handle null, undefined, or non-array responses
        if (Array.isArray(data) && data.length > 0) {
          setTests(data);
        } else {
          setTests([]);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Dashboard tests fallback:", error);
        setTests([]);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeTests]);

  const handleViewTest = (testId: string) => {
    console.log("CLICKED: test details", testId);
    router.push(`/dashboard/tests?test=${testId}`);
  };

  return (
    <>
    <div className="space-y-8">
      <Alert
        title="Demo data"
        description="Dashboard obsahuje ukázková čísla a sekce, které nejsou napojené na backend."
        variant="warning"
      />
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <Badge variant="neutral">DEMO</Badge>
        <span>Ukázkové metriky</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          title="Active learners"
          value="248"
          delta="+12% vs last week"
          icon={<Users2 className="h-5 w-5" />}
        />
        <OverviewCard
          title="Assessments"
          value="32"
          delta="4 drafts awaiting"
          icon={<NotebookTabs className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          title="Content assets"
          value="112"
          delta="+5 curated"
          icon={<BookOpenCheck className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <PermissionGate
          permission={PermissionKey.VIEW_RESULTS}
          fallback={
            <RestrictedView className="col-span-full" description="Výsledky testů jsou dostupné pouze učitelům a vedení." />
          }
        >
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Latest tests</p>
                <p className="text-lg font-semibold text-slate-900">
                  Completion & averages
                </p>
              </div>
            </div>
            {testsLoading ? (
              <LoadingSpinner label="Loading tests" className="py-8" />
            ) : tests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tests.map((test) => (
                  <TestCard key={test.id} test={test} onView={handleViewTest} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Zatím žádné testy.
              </div>
            )}
          </Card>
        </PermissionGate>
        <PermissionGate
          permission={PermissionKey.VIEW_RESULTS}
          fallback={<RestrictedView description="Výukový pokrok je dostupný jen s oprávněním k výsledkům." />}
        >
          <RestrictedView description="Student progress dashboard není v UI napojený na backend." />
        </PermissionGate>
      </div>

      {gamification && (
        <GamificationPanel
          xp={gamification.xp}
          level={gamification.level}
          nextLevelXp={gamification.nextLevelXp ?? null}
          achievements={gamification.achievements}
        />
      )}

      <PermissionGate
        permission={PermissionKey.MANAGE_TEACHERS}
        fallback={
          <RestrictedView description="Pouze vedení může plánovat týmové akce a spravovat učitele." />
        }
      >
        <RestrictedView description="Teacher overview není v UI napojený na backend." />
      </PermissionGate>

      <PermissionGate
        permission={PermissionKey.MANAGE_STUDENTS}
        fallback={<RestrictedView description="Správa tříd je dostupná pouze uživatelům s oprávněním MANAGE_STUDENTS." />}
      >
        <Card className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Badge variant="neutral">NOT IMPLEMENTED</Badge>
            <span>Classrooms UI</span>
          </div>
          <p className="text-sm text-slate-600">
            Správa tříd v dashboardu není napojená na backend. Použij API pro class sections a enrollments.
          </p>
        </Card>
      </PermissionGate>
    </div>
    <LevelUpModal
      open={levelModalOpen}
      level={gamification?.level ?? 1}
      onOpenChange={setLevelModalOpen}
    />
    </>
  );
}

export default withGuard()(DashboardPage);
