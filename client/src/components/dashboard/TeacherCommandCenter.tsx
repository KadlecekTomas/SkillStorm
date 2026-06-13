"use client";

import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { getDashboardTeacher, type TeacherDashboardResponse } from "@/lib/api/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useClassroomStructure, type ClassroomStructure } from "@/hooks/use-classroom-structure";
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

export function TeacherCommandCenter(): React.JSX.Element {
  const { user } = useAuth();
  const { activeYear } = useAcademicYears({ enabled: true });

  // Structure fetched once here — shared between MyClasses and StudentsAtRisk
  const { data: structure, loading: structureLoading } = useClassroomStructure({ enabled: true });
  const primaryClass = getPrimaryClass(structure);

  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
