"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  LayoutGrid,
  TrendingDown,
  Users,
} from "lucide-react";
import { OverviewCard } from "@/components/cards/overview-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/alert";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useAuth } from "@/hooks/use-auth";
import { useTeachers } from "@/hooks/use-teachers";
import { getNextAcademicYear } from "@/lib/api/academic-years";
import {
  getDashboardDirector,
  type DirectorDashboardResponse,
} from "@/lib/api/dashboard";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";
import { DashboardGreeting } from "./DashboardGreeting";

const PREPARATION_WINDOW_DAYS = 60;

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function formatDate(iso: string | null): string {
  if (!iso) return "bez aktivity";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
  });
}

function riskBadge(
  level: "LOW" | "MEDIUM" | "HIGH" | "NO_DATA",
): React.JSX.Element {
  if (level === "HIGH") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger-deep">
        <AlertTriangle className="h-3 w-3" />
        Vysoké riziko
      </span>
    );
  }
  if (level === "MEDIUM") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-streak/10 px-2 py-0.5 text-xs font-bold text-streak">
        <TrendingDown className="h-3 w-3" />
        Střední riziko
      </span>
    );
  }
  if (level === "NO_DATA") {
    return (
      <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-ink-dim">
        Bez dat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-deep">
      <CheckCircle2 className="h-3 w-3" />
      V pořádku
    </span>
  );
}

function CockpitSkeleton(): React.JSX.Element {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-canvas-alt p-6">
      <div className="h-4 w-40 rounded bg-surface" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-36 rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}

function AttentionCard({
  title,
  count,
  href,
  action,
  children,
}: {
  title: string;
  count: number;
  href: string;
  action: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-44 flex-col rounded-xl border border-line bg-canvas-alt p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">{title}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{count}</p>
        </div>
        {count > 0 ? (
          <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger-deep">
            Prověřit
          </span>
        ) : (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-deep">
            V pořádku
          </span>
        )}
      </div>
      <div className="mt-3 flex-1">{children}</div>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-xp transition-colors hover:text-xp-deep"
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function DirectorAttentionPanel({
  classes,
  students,
  teachers,
  hasOperationalData,
}: {
  classes: DirectorDashboardResponse["classes"];
  students: DirectorDashboardResponse["atRiskStudents"];
  teachers: DirectorDashboardResponse["teachers"];
  hasOperationalData: boolean;
}): React.JSX.Element {
  const riskyClasses = classes
    .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "MEDIUM")
    .sort((a, b) => {
      if (a.riskLevel === b.riskLevel) return (a.avgScore ?? 101) - (b.avgScore ?? 101);
      return a.riskLevel === "HIGH" ? -1 : 1;
    });
  const inactiveTeachers = teachers.filter((teacher) => !teacher.activeThisWeek);
  const signalCount = riskyClasses.length + students.length + inactiveTeachers.length;

  return (
    <Card
      data-testid="director-attention-cockpit"
      className={
        signalCount > 0
          ? "overflow-hidden border-danger/25 bg-white p-0"
          : "overflow-hidden border-accent/25 bg-white p-0"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={
                signalCount > 0
                  ? "flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft text-danger-deep"
                  : "flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-deep"
              }
            >
              {signalCount > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
                Dnešní provozní přehled
              </p>
              <h2 className="text-xl font-extrabold text-ink">Co vyžaduje pozornost</h2>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {signalCount > 0
              ? `SkillStorm našel ${signalCount} provozních signálů. Nejdřív řešte konkrétní třídy, žáky a učitele; souhrnné statistiky jsou až níže.`
              : hasOperationalData
                ? "Aktuální data neukazují žádný prioritní zásah. Můžete se soustředit na běžný provoz a vývoj školy."
                : "Zatím není dost výukových dat pro spolehlivé provozní signály. Níže vidíte stav tříd a aktivity, které se začnou plnit používáním systému."}
          </p>
        </div>
        <div
          className={
            signalCount > 0
              ? "rounded-xl bg-danger-soft px-4 py-3 text-right"
              : "rounded-xl bg-accent-soft px-4 py-3 text-right"
          }
        >
          <p className="text-2xl font-extrabold tabular-nums text-ink">{signalCount}</p>
          <p className="text-xs font-semibold text-ink-muted">signálů k prověření</p>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
        <AttentionCard
          title="Třídy s rizikem"
          count={riskyClasses.length}
          href="/app/classrooms"
          action="Otevřít třídy"
        >
          {riskyClasses.length === 0 ? (
            <p className="text-sm text-ink-muted">Žádná třída není v režimu středního nebo vysokého rizika.</p>
          ) : (
            <div className="space-y-2">
              {riskyClasses.slice(0, 3).map((classroom) => (
                <Link
                  key={classroom.id}
                  href={`/app/classrooms/${classroom.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{classroom.label}</span>
                    <span className="block truncate text-xs text-ink-dim">
                      {classroom.teacherName ?? "Bez přiřazeného učitele"}
                    </span>
                  </span>
                  <span className="flex-shrink-0 font-bold tabular-nums text-ink">
                    {classroom.avgScore === null ? "—" : `${classroom.avgScore} %`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </AttentionCard>

        <AttentionCard
          title="Žáci k prověření"
          count={students.length}
          href="/app/results"
          action="Otevřít výsledky"
        >
          {students.length === 0 ? (
            <p className="text-sm text-ink-muted">Nikdo aktuálně nespadá do přehledu nejnižších průměrů.</p>
          ) : (
            <div className="space-y-2">
              {students.slice(0, 3).map((student) => (
                <div key={student.studentId} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{student.displayName}</span>
                    <span className="block text-xs text-ink-dim">{student.classLabel}</span>
                  </span>
                  <span className="flex-shrink-0 font-bold tabular-nums text-danger-deep">
                    {Math.round(student.averageScorePercent)} %
                  </span>
                </div>
              ))}
            </div>
          )}
        </AttentionCard>

        <AttentionCard
          title="Učitelé bez aktivity"
          count={inactiveTeachers.length}
          href="/app/people"
          action="Otevřít správu lidí"
        >
          {inactiveTeachers.length === 0 ? (
            <p className="text-sm text-ink-muted">Všichni evidovaní učitelé mají tento týden zaznamenanou aktivitu.</p>
          ) : (
            <div className="space-y-2">
              {inactiveTeachers.slice(0, 3).map((teacher) => (
                <div key={teacher.membershipId} className="rounded-lg px-2 py-1.5 text-sm">
                  <p className="truncate font-bold text-ink">{teacher.name}</p>
                  <p className="text-xs text-ink-dim">Poslední aktivita: {formatDate(teacher.lastActivityAt)}</p>
                </div>
              ))}
            </div>
          )}
        </AttentionCard>
      </div>
    </Card>
  );
}

function ClassOperationalList({
  classes,
}: {
  classes: DirectorDashboardResponse["classes"];
}): React.JSX.Element {
  const sorted = [...classes].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, NO_DATA: 2, LOW: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">Třídy</p>
          <p className="text-base font-bold text-ink">Stav tříd</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/classrooms">Všechny třídy</Link>
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink-dim">Žádné třídy v aktuálním roce.</p>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((classroom) => (
            <Link
              key={classroom.id}
              href={`/app/classrooms/${classroom.id}`}
              className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-surface"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-extrabold text-ink">
                {classroom.label}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{classroom.teacherName ?? "Bez učitele"}</p>
                <p className="text-xs text-ink-dim">
                  {classroom.studentCount} žáků · {classroom.submissionsThisWeek} odevzdání tento týden
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {classroom.avgScore === null ? "—" : `${classroom.avgScore} %`}
                </span>
                {riskBadge(classroom.riskLevel)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function TeacherOperationalList({
  teachers,
}: {
  teachers: DirectorDashboardResponse["teachers"];
}): React.JSX.Element {
  const sorted = [...teachers].sort(
    (a, b) => Number(a.activeThisWeek) - Number(b.activeThisWeek) || b.submissionsThisWeek - a.submissionsThisWeek,
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">Učitelé</p>
          <p className="text-base font-bold text-ink">Aktivita učitelů</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/people">Správa lidí</Link>
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink-dim">Žádní učitelé v organizaci.</p>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((teacher) => (
            <div key={teacher.membershipId} className="flex items-center gap-4 px-6 py-3">
              <div
                className={
                  teacher.activeThisWeek
                    ? "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-deep"
                    : "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-ink-dim"
                }
              >
                {teacher.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{teacher.name}</p>
                <p className="text-xs text-ink-dim">
                  {teacher.testsCreated} testů · poslední aktivita {formatDate(teacher.lastActivityAt)}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink">{teacher.submissionsThisWeek}</p>
                  <p className="text-xs text-ink-dim">odevzdání</p>
                </div>
                <Activity
                  className={teacher.activeThisWeek ? "h-4 w-4 text-accent" : "h-4 w-4 text-ink-dim"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function DirectorSchoolCockpit(): React.JSX.Element {
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
  const error =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : dashboardQuery.error
        ? "Nepodařilo se načíst data."
        : null;

  const [preparedNextYear, setPreparedNextYear] = useState<{ id: string; label: string } | null>(null);
  const [activating, setActivating] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const homepageTeachers = useMemo<DirectorDashboardResponse["teachers"]>(() => {
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
  }, [data?.teachers, teacherRoster]);

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
      .then((next) => {
        if (!cancelled) setPreparedNextYear(next ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreparedNextYear(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeYear?.id, activeYear?.endDate]);

  const handleActivateNextYear = async (): Promise<void> => {
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

  if (error) {
    return <ErrorAlert title="Chyba načítání" description={error} />;
  }

  const firstName = getFirstName(user?.fullName ?? user?.name ?? "řediteli");
  const classes = data?.classes ?? [];
  const students = data?.atRiskStudents ?? [];
  const hasOperationalData =
    (data?.testsThisMonth ?? 0) > 0 ||
    (data?.submissionsThisWeek ?? 0) > 0 ||
    classes.some((classroom) => classroom.riskLevel !== "NO_DATA");

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={firstName}
        activeYearName={activeYear?.name ?? null}
        loading={loading}
      />

      {preparedNextYear && !bannerDismissed && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-xp/30 bg-xp/10 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-ink">Další školní rok {preparedNextYear.label} je připraven</p>
            <p className="text-xs text-ink-muted">Aktivujte ho, až budete připraveni zahájit nový rok.</p>
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

      {loading ? (
        <CockpitSkeleton />
      ) : (
        <DirectorAttentionPanel
          classes={classes}
          students={students}
          teachers={homepageTeachers}
          hasOperationalData={hasOperationalData}
        />
      )}

      <section aria-labelledby="director-school-state-heading" className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">Souhrn až po prioritách</p>
          <h2 id="director-school-state-heading" className="text-lg font-extrabold text-ink">
            Stav školy v číslech
          </h2>
        </div>
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
      </section>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CockpitSkeleton />
          <CockpitSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ClassOperationalList classes={classes} />
          <TeacherOperationalList teachers={homepageTeachers} />
        </div>
      )}

      {!loading && classes.length === 0 && homepageTeachers.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong py-14 text-center">
          <p className="font-bold text-ink">Škola je připravená, ale zatím bez provozních dat.</p>
          <p className="mt-1 text-sm text-ink-dim">
            Přidejte třídy a učitele; přehled se začne plnit skutečnou aktivitou.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/app/classrooms">Otevřít třídy</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/people">Spravovat lidi</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
