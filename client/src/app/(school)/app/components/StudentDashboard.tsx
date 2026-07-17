"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionLabel } from "@/components/ui/section-label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PartakBlob } from "@/components/partak";
import { useGamification } from "@/hooks/use-gamification";
import { useBadges } from "@/hooks/use-badges";
import { BadgesPanel } from "@/components/gamification/badges-panel";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { getDashboardStudent, type StudentDashboardResponse } from "@/lib/api/dashboard";
import { fetchWithAuth } from "@/lib/http/client";
import { formatDate } from "@/lib/format-date";
import { vocative } from "@/lib/czech-vocative";
import { ErrorAlert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

const EMPTY_SUBMISSIONS = "Zatím nemáš žádné odevzdané testy.";
const EMPTY_OPEN = "Teď na tebe nic nečeká. 🎉";

const scoreToPercent = (score: number | null | undefined): string => {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  const percent = score <= 1 ? score * 100 : score;
  return `${Math.round(percent)}%`;
};

type AssignmentRow = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  attemptsUsed: number;
  submissionId: string | null;
};

type OpenAssignment = {
  id: string;
  closeAt: string;
  testTitle: string;
};

function unwrap<T>(value: unknown): T | null {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: T }).data;
  }
  return (value as T) ?? null;
}

async function fetchOpenAssignments(): Promise<OpenAssignment[]> {
  const raw = await fetchWithAuth<AssignmentRow[] | { data?: AssignmentRow[] }>(
    "GET",
    "/assignments/my",
  );
  const rows = unwrap<AssignmentRow[]>(raw) ?? [];
  const now = Date.now();
  const open = rows
    .filter(
      (r) =>
        !r.submissionId &&
        r.attemptsUsed === 0 &&
        new Date(r.openAt).getTime() <= now &&
        now <= new Date(r.closeAt).getTime(),
    )
    .slice(0, 5);

  return Promise.all(
    open.map(async (r) => {
      const detail = await fetchWithAuth<unknown>("GET", `/tests/${r.testId}`).catch(() => null);
      const test = unwrap<{ title?: string }>(detail);
      return { id: r.id, closeAt: r.closeAt, testTitle: test?.title ?? "Test" };
    }),
  );
}

export function StudentDashboard(): React.JSX.Element {
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [openAssignments, setOpenAssignments] = useState<OpenAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { summary: gamification } = useGamification();
  const { badges } = useBadges();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getDashboardStudent(), fetchOpenAssignments()])
      .then(([res, open]) => {
        if (cancelled) return;
        setData(res);
        setOpenAssignments(open);
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
      <Card className="p-6">
        <LoadingSpinner label="Načítání..." />
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorAlert title="Chyba načítání dat" description={error} />
    );
  }

  const submissions = data?.lastSubmissions ?? [];
  const firstName =
    (data?.member.name ?? user?.fullName ?? user?.name ?? "").trim().split(" ")[0] || null;

  const xp = gamification?.xp ?? data?.member.xp ?? 0;
  const streakDays = gamification?.streakDays ?? 0;
  const level = gamification?.level ?? data?.member.level ?? 1;
  const nextLevelXp = gamification?.nextLevelXp ?? null;
  const toNext = nextLevelXp != null ? Math.max(nextLevelXp - xp, 0) : null;
  const levelProgress =
    nextLevelXp != null && nextLevelXp > 0 ? Math.min((xp / nextLevelXp) * 100, 100) : 100;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
            {firstName ? `Ahoj, ${vocative(firstName)}! 👋` : "Ahoj! 👋"}
          </h1>
          <p className="mt-1 text-base leading-relaxed text-ink-muted">
            Tvůj parťák už se těší na dnešní procvičování.
          </p>
        </div>

        {/* Hero s Parťákem — viditelný jen žákovi (viz design reference) */}
        <Card className="flex flex-wrap items-center gap-7 p-8">
          <PartakBlob size={110} />
          <div className="min-w-[220px] flex-1">
            <div className="mb-3.5 flex flex-wrap gap-2" data-testid="student-hero-badges">
              <Badge variant="info">⚡ {xp} XP</Badge>
              <Badge variant="success">Úroveň {level ?? 1}</Badge>
              {streakDays > 0 && (
                <Badge variant="warning">
                  🔥 {streakDays}{" "}
                  {streakDays === 1 ? "den" : streakDays <= 4 ? "dny" : "dní"} v řadě
                </Badge>
              )}
            </div>
            {toNext != null ? (
              <p className="mb-2 text-sm text-ink-muted">
                Do další úrovně zbývá <strong className="text-ink">{toNext} XP</strong>
              </p>
            ) : (
              <p className="mb-2 text-sm text-ink-muted">Jsi na nejvyšší sledované úrovni. 🏆</p>
            )}
            <Progress value={levelProgress} />
          </div>
        </Card>

        <section>
          <SectionLabel>Čeká na tebe</SectionLabel>
          {openAssignments.length > 0 ? (
            <div className="space-y-2.5">
              {openAssignments.map((a) => (
                <Link key={a.id} href={`/app/assignments/${a.id}`} className="block">
                  <Card hoverable className="flex items-center justify-between gap-3 px-5 py-4">
                    <span className="text-base font-bold text-ink">{a.testTitle}</span>
                    <span className="whitespace-nowrap text-[13px] font-semibold text-streak">
                      do {formatDate(a.closeAt)}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="px-5 py-8 text-center text-sm text-ink-muted">{EMPTY_OPEN}</Card>
          )}
        </section>

        <section>
          <SectionLabel>Hotovo</SectionLabel>
          {submissions.length > 0 ? (
            <div className="space-y-2.5">
              {submissions.slice(0, 5).map((sub) => (
                <Card key={sub.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-base font-bold text-ink">{sub.testTitle}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleDateString("cs-CZ")
                        : "Datum není k dispozici"}
                    </p>
                  </div>
                  {sub.score !== null ? (
                    <Badge variant="success">{scoreToPercent(sub.score)}</Badge>
                  ) : (
                    <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="px-5 py-8 text-center text-sm text-ink-muted">{EMPTY_SUBMISSIONS}</Card>
          )}
        </section>

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
