"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckSquare,
  Users,
  LayoutGrid,
  AlertTriangle,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { OverviewCard } from "@/components/cards/overview-card";
import {
  getDashboardDirector,
  type DirectorDashboardResponse,
} from "@/lib/api/dashboard";
import { getNextAcademicYear } from "@/lib/api/academic-years";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { DashboardGreeting } from "./DashboardGreeting";
import { useTeachers } from "@/hooks/use-teachers";
import { useQuery } from "@/lib/query-client";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
  });
}

function riskBadge(
  level: "LOW" | "MEDIUM" | "HIGH" | "NO_DATA",
): React.JSX.Element {
  if (level === "NO_DATA")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-ink-dim">
        Zatím bez výsledků
      </span>
    );
  if (level === "HIGH")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger-deep">
        <AlertTriangle className="h-3 w-3" />
        Vysoké riziko
      </span>
    );
  if (level === "MEDIUM")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-streak/10 px-2 py-0.5 text-xs font-bold text-streak">
        <TrendingDown className="h-3 w-3" />
        Střední riziko
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-deep">
      V pořádku
    </span>
  );
}

// ─── sub-sections ─────────────────────────────────────────────────────────────

function ClassRiskTable({
  classes,
}: {
  classes: DirectorDashboardResponse["classes"];
}): React.JSX.Element {
  const sorted = [...classes].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2, NO_DATA: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
          Třídy
        </p>
        <p className="text-base font-bold text-ink">
          Výkonnost tříd
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink-dim">
          Žádné třídy v aktuálním roce.
        </p>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((cls) => (
            <div
              key={cls.id}
              className="flex items-center gap-4 px-6 py-3 hover:bg-surface transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-sm font-extrabold text-ink">
                {cls.label}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {cls.teacherName ?? "—"}
                </p>
                <p className="text-xs text-ink-dim">
                  {cls.studentCount} žáků · {cls.submissionsThisWeek} odevzdání tento týden
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {cls.avgScore !== null ? `${cls.avgScore} %` : "—"}
                </span>
                {riskBadge(cls.riskLevel)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TeacherActivityList({
  teachers,
}: {
  teachers: DirectorDashboardResponse["teachers"];
}): React.JSX.Element {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
          Učitelé
        </p>
        <p className="text-base font-bold text-ink">
          Aktivita učitelů
        </p>
      </div>
      {teachers.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink-dim">
          Žádní učitelé v organizaci.
        </p>
      ) : (
        <div className="divide-y divide-line/60">
          {teachers.map((t) => (
            <div
              key={t.membershipId}
              className="flex items-center gap-4 px-6 py-3 hover:bg-surface transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-xp/10 text-sm font-bold text-xp">
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {t.name}
                </p>
                <p className="text-xs text-ink-dim">
                  {t.testsCreated}{" "}
                  {t.testsCreated === 1
                    ? "test"
                    : t.testsCreated >= 2 && t.testsCreated <= 4
                      ? "testy"
                      : "testů"}{" "}
                  · poslední aktivita {formatDate(t.lastActivityAt)}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-ink tabular-nums">
                  {t.submissionsThisWeek}
                </p>
                <p className="text-xs text-ink-dim">tento týden</p>
              </div>
              {t.activeThisWeek ? (
                <Activity className="h-4 w-4 flex-shrink-0 text-accent" />
              ) : (
                <div className="h-4 w-4 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StudentRiskList({
  students,
}: {
  students: DirectorDashboardResponse["atRiskStudents"];
}): React.JSX.Element {
  if (students.length === 0) return <></>;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
          Žáci v ohrožení
        </p>
        <p className="text-base font-bold text-ink">
          Nejnižší průměry
        </p>
      </div>
      <div className="divide-y divide-line/60">
        {students.map((s) => (
          <div
            key={s.studentId}
            className="flex items-center gap-4 px-6 py-3 hover:bg-surface transition-colors"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-danger-soft text-sm font-bold text-danger-deep">
              {s.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {s.displayName}
              </p>
              <p className="text-xs text-ink-dim">{s.classLabel}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-bold text-danger tabular-nums">
                {Math.round(s.averageScorePercent)} %
              </p>
              <p className="text-xs text-ink-dim">průměr</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CardSkeleton(): React.JSX.Element {
  return (
    <div className="animate-pulse rounded-xl border border-line bg-canvas-alt p-6">
      <div className="h-3 w-24 rounded bg-surface" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-surface" />
        <div className="h-3 w-3/4 rounded bg-surface" />
        <div className="h-3 w-1/2 rounded bg-surface" />
      </div>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

const PREPARATION_WINDOW_DAYS = 60;

export function DirectorCommandCenter(): React.JSX.Element {
  const { user } = useAuth();
  const { activeYear, refresh: refreshYears } = useAcademicYears({ enabled: true });
  const { teachers: teacherRoster } = useTeachers();
  const dashboardQuery = useQuery<DirectorDashboardResponse>({
    queryKey: ["dashboard", "director", user?.organizationId ?? null],
    enabled: !!user?.organizationId,
    staleTime: 10_000,
    queryFn: getDashboardDirector,
  });
  const data = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.error instanceof Error
    ? dashboardQuery.error.message
    : dashboardQuery.error
      ? "Nepodařilo se načíst data."
      : null;

  // Next year banner: shown when cron pre-created the next year and activation is needed.
  const [preparedNextYear, setPreparedNextYear] = useState<{ id: string; label: string } | null>(null);
  const [activating, setActivating] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const homepageTeachers = (() => {
    const activityByMembershipId = new Map(
      (data?.teachers ?? []).map((teacher) => [teacher.membershipId, teacher]),
    );
    return teacherRoster
      .map((teacher) => {
        const membershipId = teacher.membership?.id;
        const activity = membershipId ? activityByMembershipId.get(membershipId) : undefined;
        return {
          membershipId: membershipId ?? teacher.id,
          name:
            teacher.membership?.user?.name?.trim() ||
            teacher.membership?.user?.email ||
            "—",
          testsCreated: activity?.testsCreated ?? 0,
          submissionsThisWeek: activity?.submissionsThisWeek ?? 0,
          lastActivityAt: activity?.lastActivityAt ?? null,
          activeThisWeek: activity?.activeThisWeek ?? false,
        };
      })
      .sort((a, b) => b.submissionsThisWeek - a.submissionsThisWeek || a.name.localeCompare(b.name, "cs"));
  })();

  // Check if the cron prepared a next year when the active year is within the 60-day window.
  useEffect(() => {
    if (!activeYear?.id || !activeYear.endDate) return;
    const msUntilEnd = new Date(activeYear.endDate).getTime() - Date.now();
    const withinWindow = msUntilEnd <= PREPARATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (!withinWindow) {
      setPreparedNextYear(null);
      return;
    }
    let cancelled = false;
    getNextAcademicYear(activeYear.id)
      .then((next) => { if (!cancelled) setPreparedNextYear(next ?? null); })
      .catch(() => { if (!cancelled) setPreparedNextYear(null); });
    return () => { cancelled = true; };
  }, [activeYear?.id, activeYear?.endDate]);

  const handleActivateNextYear = async () => {
    if (!preparedNextYear) return;
    setActivating(true);
    try {
      await fetchWithAuth("PATCH", `/academic-years/${preparedNextYear.id}/activate`);
      setBannerDismissed(true);
      void refreshYears();
    } finally {
      setActivating(false);
    }
  };

  const firstName = getFirstName(user?.fullName ?? user?.name ?? "řediteli");

  if (error) {
    return <ErrorAlert title="Chyba načítání" description={error} />;
  }

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={firstName}
        activeYearName={activeYear?.name ?? null}
        loading={loading}
      />

      {/* Next year ready banner */}
      {preparedNextYear && !bannerDismissed && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-xp/30 bg-xp/10 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-ink">
              Další školní rok {preparedNextYear.label} je připraven
            </p>
            <p className="text-xs text-ink-muted">
              Aktivujte ho, až budete připraveni zahájit nový rok.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void handleActivateNextYear()}
              disabled={activating}
              className="bg-xp text-white [--tactile-shadow:rgb(var(--xp-deep))] shadow-tactile hover:brightness-105 active:translate-y-[2px] active:shadow-tactile-pressed"
            >
              {activating ? "Aktivace…" : `Aktivovat ${preparedNextYear.label}`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBannerDismissed(true)}
              disabled={activating}
              className="text-ink-muted"
            >
              Zavřít
            </Button>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          title="Testy tento měsíc"
          value={loading ? "…" : String(data?.testsThisMonth ?? 0)}
          icon={<BookOpen className="h-5 w-5" />}
          accent="bg-xp/10 text-xp"
        />
        <OverviewCard
          title="Odevzdání tento týden"
          value={loading ? "…" : String(data?.submissionsThisWeek ?? 0)}
          icon={<CheckSquare className="h-5 w-5" />}
          accent="bg-accent-soft text-accent-deep"
        />
        <OverviewCard
          title="Aktivní učitelé"
          value={loading ? "…" : String(data?.activeTeachersThisWeek ?? 0)}
          delta="tento týden"
          icon={<Users className="h-5 w-5" />}
          accent="bg-accent-soft text-accent-deep"
        />
        <OverviewCard
          title="Aktivní třídy"
          value={loading ? "…" : String(data?.activeClassesThisWeek ?? 0)}
          delta="tento týden"
          icon={<LayoutGrid className="h-5 w-5" />}
          accent="bg-streak/10 text-streak"
        />
      </div>

      {/* Main body: classes + teachers side by side */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ClassRiskTable classes={data?.classes ?? []} />
          <TeacherActivityList teachers={homepageTeachers} />
        </div>
      )}

      {/* At-risk students — full width, only when data loaded and list non-empty */}
      {!loading && (data?.atRiskStudents.length ?? 0) > 0 && (
        <StudentRiskList students={data?.atRiskStudents ?? []} />
      )}

      {/* Proč vedení nevidí parťáky — záměrné designové rozhodnutí (viz design reference) */}
      <div className="rounded-xl border border-line border-l-4 border-l-xp bg-canvas-alt px-5 py-4">
        <p className="mb-1 text-sm font-bold text-ink">Proč tu nevidíte parťáky žáků?</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Motivační společník je viditelný pouze žákovi. Kdyby se stal metrikou pro vedení,
          ztratil by svou hodnotu bezpečného prostoru — žáci by ho začali vnímat jako další známku.
        </p>
      </div>

      {/* Empty state — no data at all */}
      {!loading && !error && data?.classes.length === 0 && data?.teachers.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong py-16 text-center">
          <p className="text-sm text-ink-dim">
            V aktuálním školním roce zatím neproběhla žádná aktivita.
          </p>
        </div>
      )}
    </div>
  );
}
