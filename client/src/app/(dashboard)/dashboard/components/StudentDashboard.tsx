"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useGamification } from "@/hooks/use-gamification";
import { useBadges } from "@/hooks/use-badges";
import { GamificationPanel } from "@/components/gamification/gamification-panel";
import { BadgesPanel } from "@/components/gamification/badges-panel";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import {
  getDashboardStudent,
  getAssignmentsOverview,
  type StudentDashboardResponse,
  type AssignmentsOverviewResponse,
  type AssignmentOverviewItem,
} from "@/lib/api/dashboard";
import { BookOpenCheck, NotebookTabs, ClipboardList } from "lucide-react";
import { OverviewCard } from "@/components/cards/overview-card";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/lib/format-date";

const scoreToPercent = (score: number | null | undefined): string => {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  const percent = score <= 1 ? score * 100 : score;
  return `${Math.round(percent)}%`;
};

export function StudentDashboard(): React.JSX.Element {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [overview, setOverview] = useState<AssignmentsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { summary: gamification } = useGamification();
  const { badges } = useBadges();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getDashboardStudent(), getAssignmentsOverview()])
      .then(([dashRes, overviewRes]) => {
        if (!cancelled) {
          overviewRes.active.forEach((item) => {
            console.log("assignment.openAt raw:", item.openAt);
          });
          setData(dashRes);
          setOverview(overviewRes);
        }
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
  }, []);

  useEffect(() => {
    if (gamification?.level != null && previousLevelRef.current !== null && gamification.level > previousLevelRef.current) {
      setLevelModalOpen(true);
    }
    if (gamification?.level !== undefined) {
      previousLevelRef.current = gamification.level ?? null;
    }
  }, [gamification]);

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
    return (
      <Alert title="Chyba načítání dat" description={error} variant="warning" />
    );
  }

  const submissions = data?.lastSubmissions ?? [];
  const activeTests = overview?.active ?? [];
  const upcomingCount = overview?.upcoming.length ?? 0;
  const closedCount = overview?.closedUnsubmitted.length ?? 0;
  const completedCount = overview?.completed.length ?? 0;

  return (
    <>
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <OverviewCard
            title="Dokončené testy"
            value={String(data?.testsTaken ?? 0)}
            delta="Celkem odevzdáno"
            icon={<NotebookTabs className="h-5 w-5" />}
            accent="bg-blue-50 text-blue-600"
          />
          <OverviewCard
            title="Průměrné skóre"
            value={
              data?.avgScore != null ? scoreToPercent(data.avgScore) : "—"
            }
            delta="Z vyhodnocených testů"
            icon={<BookOpenCheck className="h-5 w-5" />}
            accent="bg-amber-50 text-amber-600"
          />
        </div>

        {/* Active tests section — always visible */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Právě probíhající</p>
              <p className="text-lg font-semibold text-slate-900">Moje aktivní testy</p>
            </div>
            <ClipboardList className="h-5 w-5 text-slate-400" />
          </div>

          {activeTests.length > 0 ? (
            <div className="space-y-2">
              {activeTests.map((item: AssignmentOverviewItem) => (
                <div
                  key={item.assignmentId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      Do: {formatDate(item.closeAt)}
                      {" · "}
                      {item.remainingAttempts === 1
                        ? "1 pokus zbývá"
                        : `${item.remainingAttempts} pokusy zbývají`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-3 shrink-0"
                    onClick={() => router.push(`/dashboard/assignments/${item.assignmentId}`)}
                  >
                    {item.attemptsUsed > 0 ? "Pokračovat" : "Spustit"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">Nemáš žádné aktivní testy.</p>
              <p className="mt-1 text-xs text-slate-400">
                Pokud čekáš na test, ověř, že jsi zapsaný ve správné třídě pro aktuální školní rok.
              </p>
            </div>
          )}

          {/* Summary link row */}
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <button
              className="hover:text-slate-800 hover:underline"
              onClick={() => router.push("/dashboard/assignments")}
            >
              Aktivní: <span className="font-semibold text-slate-700">{activeTests.length}</span>
            </button>
            <span>·</span>
            <button
              className="hover:text-slate-800 hover:underline"
              onClick={() => router.push("/dashboard/assignments")}
            >
              Nadcházející: <span className="font-semibold text-slate-700">{upcomingCount}</span>
            </button>
            <span>·</span>
            <button
              className="hover:text-slate-800 hover:underline"
              onClick={() => router.push("/dashboard/assignments")}
            >
              Uzavřené bez pokusu: <span className="font-semibold text-slate-700">{closedCount}</span>
            </button>
            <span>·</span>
            <button
              className="hover:text-slate-800 hover:underline"
              onClick={() => router.push("/dashboard/assignments")}
            >
              Dokončené: <span className="font-semibold text-slate-700">{completedCount}</span>
            </button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Poslední aktivity</p>
            <p className="text-lg font-semibold text-slate-900">Moje odevzdání</p>
          </div>
          {submissions.length > 0 ? (
            <div className="space-y-2">
              {submissions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{sub.testTitle}</p>
                    <p className="text-xs text-slate-500">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleDateString("cs-CZ")
                        : "Datum není k dispozici"}
                    </p>
                  </div>
                  {sub.score !== null ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {scoreToPercent(sub.score)}
                    </p>
                  ) : (
                    <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Žádná odevzdání.</p>
          )}
        </Card>

        {gamification && (
          <GamificationPanel
            xp={gamification.xp}
            level={gamification.level}
            nextLevelXp={gamification.nextLevelXp ?? null}
            achievements={gamification.achievements}
          />
        )}

        <BadgesPanel badges={badges} />
      </div>
      <LevelUpModal
        open={levelModalOpen}
        level={gamification?.level ?? 1}
        onOpenChange={setLevelModalOpen}
      />
    </>
  );
}
