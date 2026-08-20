"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Sparkles,
  Trophy,
} from "lucide-react";
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
import {
  getDashboardStudent,
  type StudentDashboardResponse,
} from "@/lib/api/dashboard";
import { fetchWithAuth } from "@/lib/http/client";
import { formatDate } from "@/lib/format-date";
import { vocative } from "@/lib/czech-vocative";
import { ErrorAlert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyStudentProgress,
  type StudentSelfProgress,
} from "@/lib/student-progress";

const EMPTY_SUBMISSIONS = "Zatím nemáš žádné odevzdané testy.";

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
    .sort(
      (a, b) =>
        new Date(a.closeAt).getTime() - new Date(b.closeAt).getTime(),
    )
    .slice(0, 5);

  return Promise.all(
    open.map(async (r) => {
      const detail = await fetchWithAuth<unknown>("GET", `/tests/${r.testId}`).catch(
        () => null,
      );
      const test = unwrap<{ title?: string }>(detail);
      return {
        id: r.id,
        closeAt: r.closeAt,
        testTitle: test?.title ?? "Test",
      };
    }),
  );
}

function StudentProgressPanel({
  data,
  loading,
  error,
}: {
  data: StudentSelfProgress | null;
  loading: boolean;
  error: string | null;
}): React.JSX.Element {
  if (loading) {
    return (
      <Card className="p-6">
        <LoadingSpinner label="Načítám tvůj pokrok..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-danger/30 p-5" role="status">
        <p className="font-bold text-ink">Pokrok se teď nepodařilo načíst.</p>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="px-5 py-8 text-center text-sm text-ink-muted">
        Škola zatím nezapsala žádný průběžný pokrok.
      </Card>
    );
  }

  const hasSummary =
    data.summary.averageGrade !== null ||
    data.summary.competencyMasteryPercent !== null ||
    data.summary.attendanceRate !== null;
  const recent = data.timeline.slice(0, 5);

  return (
    <div className="space-y-3" data-testid="student-school-progress">
      {hasSummary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">
              Průměrná známka
            </p>
            <p className="mt-1 text-2xl font-black text-ink">
              {data.summary.averageGrade?.toFixed(2) ?? "—"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">
              Kompetence
            </p>
            <p className="mt-1 text-2xl font-black text-ink">
              {data.summary.competencyMasteryPercent === null
                ? "—"
                : `${data.summary.competencyMasteryPercent} %`}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">
              Docházka
            </p>
            <p className="mt-1 text-2xl font-black text-ink">
              {data.summary.attendanceRate === null
                ? "—"
                : `${data.summary.attendanceRate} %`}
            </p>
          </Card>
        </div>
      )}

      {recent.length > 0 ? (
        <div className="space-y-2.5">
          {recent.map((item) => (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{item.title}</p>
                  {item.detail && (
                    <p className="mt-1 break-words text-sm leading-relaxed text-ink-muted">
                      {item.detail}
                    </p>
                  )}
                  {item.authorName && (
                    <p className="mt-1 text-xs font-semibold text-ink-dim">
                      {item.authorName}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs font-semibold text-ink-dim">
                  {formatDate(item.occurredAt)}
                </time>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="px-5 py-8 text-center text-sm text-ink-muted">
          Učitel zatím nepřidal žádný záznam do tvé historie.
        </Card>
      )}
    </div>
  );
}

export function StudentDashboard(): React.JSX.Element {
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [openAssignments, setOpenAssignments] = useState<OpenAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolProgress, setSchoolProgress] = useState<StudentSelfProgress | null>(
    null,
  );
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);
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
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Nepodařilo se načíst data.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProgressLoading(true);
    setProgressError(null);
    getMyStudentProgress()
      .then((progress) => {
        if (!cancelled) setSchoolProgress(progress);
      })
      .catch((err) => {
        if (!cancelled) {
          setProgressError(
            err instanceof Error ? err.message : "Zkus stránku znovu načíst.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      gamification?.level != null &&
      previousLevelRef.current !== null &&
      gamification.level > previousLevelRef.current
    ) {
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
    return <ErrorAlert title="Chyba načítání dat" description={error} />;
  }

  const submissions = data?.lastSubmissions ?? [];
  const firstName =
    (data?.member.name ?? user?.fullName ?? user?.name ?? "")
      .trim()
      .split(" ")[0] || null;

  const xp = gamification?.xp ?? data?.member.xp ?? 0;
  const streakDays = gamification?.streakDays ?? 0;
  const level = gamification?.level ?? data?.member.level ?? 1;
  const nextLevelXp = gamification?.nextLevelXp ?? null;
  const toNext = nextLevelXp != null ? Math.max(nextLevelXp - xp, 0) : null;
  const levelProgress =
    nextLevelXp != null && nextLevelXp > 0
      ? Math.min((xp / nextLevelXp) * 100, 100)
      : 100;
  const primaryAssignment = openAssignments[0] ?? null;
  const remainingAssignments = openAssignments.slice(1);

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
            {firstName ? `Ahoj, ${vocative(firstName)}! 👋` : "Ahoj! 👋"}
          </h1>
          <p className="mt-1 text-base leading-relaxed text-ink-muted">
            Nemusíš nic hledat. Tady máš nejdůležitější další krok.
          </p>
        </div>

        {primaryAssignment ? (
          <Link
            href={`/app/assignments/${primaryAssignment.id}`}
            className="group block"
            data-testid="student-primary-action"
          >
            <div className="overflow-hidden rounded-3xl border-2 border-accent bg-gradient-to-br from-accent-soft via-white to-canvas-alt p-6 shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-transform group-hover:-translate-y-0.5 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.08em] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                    Teď pokračuj
                  </div>
                  <h2 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                    {primaryAssignment.testTitle}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-muted">
                    <Clock3 className="h-4 w-4 text-streak" />
                    Odevzdat do {formatDate(primaryAssignment.closeAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="hidden sm:block">
                    <PartakBlob size={92} />
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))]">
                    Začít teď
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Card className="overflow-hidden border-accent/25 bg-gradient-to-br from-accent-soft via-white to-canvas-alt p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xl font-black text-ink">Pro tuto chvíli máš hotovo. 🎉</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  Můžeš se podívat na svůj pokrok nebo si zopakovat poslední výsledky.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card
          className="flex flex-wrap items-center gap-6 p-6"
          data-testid="student-hero-card"
        >
          <div className="hidden sm:block">
            <PartakBlob size={82} />
          </div>
          <div className="min-w-[220px] flex-1">
            <div
              className="mb-3 flex flex-wrap gap-2"
              data-testid="student-hero-badges"
            >
              <Badge variant="info">⚡ {xp} XP</Badge>
              <Badge variant="success">Úroveň {level ?? 1}</Badge>
              {streakDays > 0 && (
                <Badge variant="warning">
                  🔥 {streakDays}{" "}
                  {streakDays === 1
                    ? "den"
                    : streakDays <= 4
                      ? "dny"
                      : "dní"}{" "}
                  v řadě
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                {toNext != null ? (
                  <>
                    Do další úrovně zbývá{" "}
                    <strong className="text-ink">{toNext} XP</strong>
                  </>
                ) : (
                  "Jsi na nejvyšší sledované úrovni. 🏆"
                )}
              </p>
              <Trophy className="h-4 w-4 shrink-0 text-streak" />
            </div>
            <div className="mt-2">
              <Progress value={levelProgress} />
            </div>
          </div>
        </Card>

        {remainingAssignments.length > 0 && (
          <section>
            <SectionLabel>Potom pokračuj</SectionLabel>
            <div className="space-y-2.5">
              {remainingAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/app/assignments/${assignment.id}`}
                  className="block"
                >
                  <Card
                    hoverable
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-ink">
                        {assignment.testTitle}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-ink-muted">
                        další otevřené zadání
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[13px] font-semibold text-streak">
                      do {formatDate(assignment.closeAt)}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel>Můj pokrok</SectionLabel>
          <StudentProgressPanel
            data={schoolProgress}
            loading={progressLoading}
            error={progressError}
          />
        </section>

        <section>
          <SectionLabel>Hotovo</SectionLabel>
          {submissions.length > 0 ? (
            <div className="space-y-2.5">
              {submissions.slice(0, 5).map((sub) => (
                <Card
                  key={sub.id}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
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
            <Card className="px-5 py-8 text-center text-sm text-ink-muted">
              {EMPTY_SUBMISSIONS}
            </Card>
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
