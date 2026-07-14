"use client";

import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { getDashboardTeacher, type TeacherDashboardResponse } from "@/lib/api/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useClassroomStructure, type ClassroomStructure } from "@/hooks/use-classroom-structure";
import { BleskovkaSetupDialog } from "@/components/live-sessions/bleskovka-setup-dialog";
import { DashboardGreeting } from "./DashboardGreeting";
import { PendingTasks } from "./PendingTasks";
import { MyClasses } from "./TodayClasses";
import { StudentsAtRisk } from "./StudentsAtRisk";
import { RecentSubmissions } from "./RecentSubmissions";

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

const gradeLabel = (grade: string) => {
  if (grade.startsWith("GRADE_")) return grade.replace("GRADE_", "");
  if (grade.startsWith("HIGH_SCHOOL_YEAR_")) return `S${grade.replace("HIGH_SCHOOL_YEAR_", "")}`;
  return grade;
};

function getPrimaryClass(structure: ClassroomStructure | null) {
  const cls = structure?.homeroom ?? structure?.teachingClasses[0] ?? null;
  if (!cls) return null;
  return {
    id: cls.id,
    label: cls.label ?? `${gradeLabel(cls.grade)}.${cls.section}`,
    isHomeroom: structure?.homeroom?.id === cls.id,
  };
}

function CardSkeleton() {
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

export function TeacherCommandCenter(): React.JSX.Element {
  const { user } = useAuth();
  const { activeYear } = useAcademicYears({ enabled: true });

  // Structure fetched once here — shared between MyClasses and StudentsAtRisk
  const { data: structure, loading: structureLoading } = useClassroomStructure({ enabled: true });
  const primaryClass = getPrimaryClass(structure);

  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bleskovkaOpen, setBleskovkaOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDashLoading(true);
    setError(null);
    getDashboardTeacher()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Nepodařilo se načíst data."); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = getFirstName(user?.fullName ?? user?.name ?? "učiteli");
  const pendingSubmissions = data?.pendingSubmissions ?? 0;
  const recentActivity = data?.recentActivity ?? [];

  if (error) {
    return <ErrorAlert title="Chyba načítání" description={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Sticky context header — always anchors teacher to date + year */}
      <DashboardGreeting
        firstName={firstName}
        activeYearName={activeYear?.name ?? null}
        loading={dashLoading}
      />

      {/* Bleskovka — živé cvičení na tabuli, max 3 kroky od dashboardu ke hře */}
      <button
        type="button"
        data-testid="bleskovka-open"
        onClick={() => setBleskovkaOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border-2 border-accent bg-accent-soft px-6 py-4 text-left shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all hover:bg-accent-soft/70 active:translate-y-[2px] active:shadow-tactile-pressed"
      >
        <span>
          <span className="text-lg font-extrabold text-ink">
            ⚡ Bleskovka
          </span>
          <span className="ml-3 text-sm font-semibold text-ink-muted">
            Živé cvičení pro celou třídu na tabuli
          </span>
        </span>
        <span className="rounded-xl bg-accent px-4 py-1.5 text-sm font-bold text-white">
          Spustit
        </span>
      </button>
      <BleskovkaSetupDialog
        open={bleskovkaOpen}
        onOpenChange={setBleskovkaOpen}
      />

      {/* Pending action banner — only shown when there is work to do */}
      {!dashLoading && <PendingTasks pendingSubmissions={pendingSubmissions} />}

      {/* Two-column middle section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {structureLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <MyClasses structure={structure} />
            <StudentsAtRisk primaryClass={primaryClass} structureLoading={structureLoading} />
          </>
        )}
      </div>

      {/* Full-width activity feed */}
      {dashLoading ? (
        <CardSkeleton />
      ) : (
        <RecentSubmissions items={recentActivity} />
      )}
    </div>
  );
}
