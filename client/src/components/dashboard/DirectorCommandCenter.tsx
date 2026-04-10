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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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

function riskBadge(level: "LOW" | "MEDIUM" | "HIGH"): React.JSX.Element {
  if (level === "HIGH")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <AlertTriangle className="h-3 w-3" />
        Vysoké riziko
      </span>
    );
  if (level === "MEDIUM")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
        <TrendingDown className="h-3 w-3" />
        Střední riziko
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
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
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Třídy
        </p>
        <p className="text-base font-semibold text-slate-900">
          Výkonnost tříd
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-400">
          Žádné třídy v aktuálním roce.
        </p>
      ) : (
        <div className="divide-y divide-slate-50">
          {sorted.map((cls) => (
            <div
              key={cls.id}
              className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                {cls.label}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {cls.teacherName ?? "—"}
                </p>
                <p className="text-xs text-slate-400">
                  {cls.studentCount} žáků · {cls.submissionsThisWeek} odevzdání tento týden
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-slate-800">
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
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Učitelé
        </p>
        <p className="text-base font-semibold text-slate-900">
          Aktivita učitelů
        </p>
      </div>
      {teachers.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-400">
          Žádní učitelé v organizaci.
        </p>
      ) : (
        <div className="divide-y divide-slate-50">
          {teachers.map((t) => (
            <div
              key={t.membershipId}
              className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {t.name}
                </p>
                <p className="text-xs text-slate-400">
                  {t.testsCreated} testů · poslední aktivita{" "}
                  {formatDate(t.lastActivityAt)}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {t.submissionsThisWeek}
                </p>
                <p className="text-xs text-slate-400">tento týden</p>
              </div>
              {t.activeThisWeek ? (
                <Activity className="h-4 w-4 flex-shrink-0 text-emerald-500" />
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
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Žáci v ohrožení
        </p>
        <p className="text-base font-semibold text-slate-900">
          Nejnižší průměry
        </p>
      </div>
      <div className="divide-y divide-slate-50">
        {students.map((s) => (
          <div
            key={s.studentId}
            className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-500">
              {s.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {s.displayName}
              </p>
              <p className="text-xs text-slate-400">{s.classLabel}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-bold text-red-600">
                {s.averageScorePercent} %
              </p>
              <p className="text-xs text-slate-400">průměr</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CardSkeleton(): React.JSX.Element {
  return (
    <div className="animate-pulse rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="h-3 w-24 rounded bg-slate-100" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
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
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-indigo-800">
              Další školní rok {preparedNextYear.label} je připraven
            </p>
            <p className="text-xs text-indigo-600">
              Aktivujte ho, až budete připraveni zahájit nový rok.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void handleActivateNextYear()}
              disabled={activating}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {activating ? "Aktivace…" : `Aktivovat ${preparedNextYear.label}`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBannerDismissed(true)}
              disabled={activating}
              className="rounded-xl text-indigo-600 hover:bg-indigo-100"
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
          accent="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          title="Odevzdání tento týden"
          value={loading ? "…" : String(data?.submissionsThisWeek ?? 0)}
          icon={<CheckSquare className="h-5 w-5" />}
          accent="bg-violet-50 text-violet-600"
        />
        <OverviewCard
          title="Aktivní učitelé"
          value={loading ? "…" : String(data?.activeTeachersThisWeek ?? 0)}
          delta="tento týden"
          icon={<Users className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <OverviewCard
          title="Aktivní třídy"
          value={loading ? "…" : String(data?.activeClassesThisWeek ?? 0)}
          delta="tento týden"
          icon={<LayoutGrid className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
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

      {/* Empty state — no data at all */}
      {!loading && !error && data?.classes.length === 0 && data?.teachers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-400">
            V aktuálním školním roce zatím neproběhla žádná aktivita.
          </p>
        </div>
      )}
    </div>
  );
}
