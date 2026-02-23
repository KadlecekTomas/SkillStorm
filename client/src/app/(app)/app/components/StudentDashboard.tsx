"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useGamification } from "@/hooks/use-gamification";
import { GamificationPanel } from "@/components/gamification/gamification-panel";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { getDashboardStudent, type StudentDashboardResponse } from "@/lib/api/dashboard";
import { BookOpenCheck, NotebookTabs } from "lucide-react";
import { OverviewCard } from "@/components/cards/overview-card";
import { ErrorAlert } from "@/components/ui/alert";

const EMPTY_SUBMISSIONS = "Nemáš žádná aktivní zadání.";

export function StudentDashboard(): React.JSX.Element {
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { summary: gamification } = useGamification();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardStudent()
      .then((res) => {
        if (!cancelled) setData(res);
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
      <ErrorAlert title="Chyba načítání dat" description={error} />
    );
  }

  const submissions = data?.lastSubmissions ?? [];

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
              data?.avgScore != null ? `${Math.round(data.avgScore)}%` : "—"
            }
            delta="Z vyhodnocených testů"
            icon={<BookOpenCheck className="h-5 w-5" />}
            accent="bg-amber-50 text-amber-600"
          />
        </div>

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
                      {Math.round(sub.score)}%
                    </p>
                  ) : (
                    <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{EMPTY_SUBMISSIONS}</p>
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
      </div>
      <LevelUpModal
        open={levelModalOpen}
        level={gamification?.level ?? 1}
        onOpenChange={setLevelModalOpen}
      />
    </>
  );
}
