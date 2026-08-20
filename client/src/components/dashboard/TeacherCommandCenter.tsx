"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import { ErrorAlert } from "@/components/ui/alert";
import {
  getDashboardTeacher,
  type TeacherDashboardResponse,
} from "@/lib/api/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import {
  useClassroomStructure,
  type ClassroomStructure,
} from "@/hooks/use-classroom-structure";
import { formatClassName } from "@/lib/class-label";
import { BleskovkaSetupDialog } from "@/components/live-sessions/bleskovka-setup-dialog";
import { DashboardGreeting } from "./DashboardGreeting";
import { PendingTasks } from "./PendingTasks";
import { MyClasses } from "./TodayClasses";
import { StudentsAtRisk } from "./StudentsAtRisk";
import { RecentSubmissions } from "./RecentSubmissions";

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function getPrimaryClass(structure: ClassroomStructure | null) {
  const cls = structure?.homeroom ?? structure?.teachingClasses[0] ?? null;
  if (!cls) return null;
  return {
    id: cls.id,
    label: formatClassName(cls),
    isHomeroom: structure?.homeroom?.id === cls.id,
  };
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-canvas-alt p-6">
      <div className="h-3 w-24 rounded bg-surface" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-surface" />
        <div className="h-3 w-3/4 rounded bg-surface" />
        <div className="h-3 w-1/2 rounded bg-surface" />
      </div>
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line/80 bg-white/80 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none text-ink tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

export function TeacherCommandCenter(): React.JSX.Element {
  const { user } = useAuth();
  const { activeYear } = useAcademicYears({ enabled: true });
  const { data: structure, loading: structureLoading } = useClassroomStructure({
    enabled: true,
  });
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
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Nepodařilo se načíst data.",
          );
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = getFirstName(user?.fullName ?? user?.name ?? "učiteli");
  const pendingSubmissions = data?.pendingSubmissions ?? 0;
  const recentActivity = data?.recentActivity ?? [];
  const classes = useMemo(() => {
    const rows = [
      ...(structure?.homeroom ? [structure.homeroom] : []),
      ...(structure?.teachingClasses ?? []),
    ];
    return Array.from(new Map(rows.map((row) => [row.id, row])).values());
  }, [structure]);
  const studentCount = classes.reduce(
    (sum, classroom) => sum + (classroom.studentCount ?? 0),
    0,
  );

  if (error) {
    return <ErrorAlert title="Chyba načítání" description={error} />;
  }

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={firstName}
        activeYearName={activeYear?.name ?? null}
        loading={dashLoading}
      />

      <section className="overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft via-canvas-alt to-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr_.9fr] lg:p-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/70 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.08em] text-accent-deep">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Dnes ve škole
            </div>
            <h2 className="max-w-2xl text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Začni tím, co má pro tvoje třídy největší dopad.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              Odevzdání k opravě, tvoje třídy a živá výuka jsou na jednom místě.
              Žádné hledání po administraci.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric
                icon={<BookOpen className="h-4 w-4" />}
                value={structureLoading ? "…" : String(classes.length)}
                label="moje třídy"
              />
              <Metric
                icon={<Users className="h-4 w-4" />}
                value={structureLoading ? "…" : String(studentCount)}
                label="žáků v péči"
              />
              <Metric
                icon={<ClipboardCheck className="h-4 w-4" />}
                value={dashLoading ? "…" : String(pendingSubmissions)}
                label="čeká na kontrolu"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-accent/20 bg-white/80 p-5 shadow-sm">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))]">
                <Zap className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-black text-ink">Bleskovka pro celou třídu</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Spusť živé procvičování na tabuli během pár sekund. Bez vytváření testu předem.
              </p>
            </div>
            <button
              type="button"
              data-testid="bleskovka-open"
              onClick={() => setBleskovkaOpen(true)}
              className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-tactile-pressed"
            >
              Spustit Bleskovku
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <BleskovkaSetupDialog
        open={bleskovkaOpen}
        onOpenChange={setBleskovkaOpen}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/app/tests/create"
          className="group flex items-center justify-between rounded-2xl border border-line bg-canvas-alt px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-ink">Vytvořit test</p>
              <p className="text-xs text-ink-muted">Nové zadání pro třídu</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-dim transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/app/assignments"
          className="group flex items-center justify-between rounded-2xl border border-line bg-canvas-alt px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-xp/35 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-xp/10 text-xp">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-ink">Zadání a odevzdání</p>
              <p className="text-xs text-ink-muted">Co čeká na vyhodnocení</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-dim transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/app/classrooms"
          className="group flex items-center justify-between rounded-2xl border border-line bg-canvas-alt px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-streak/35 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-streak/10 text-streak">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-ink">Otevřít třídy</p>
              <p className="text-xs text-ink-muted">Žáci, výsledky a pokrok</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-dim transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {!dashLoading && <PendingTasks pendingSubmissions={pendingSubmissions} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {structureLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <MyClasses structure={structure} />
            <StudentsAtRisk
              primaryClass={primaryClass}
              structureLoading={structureLoading}
            />
          </>
        )}
      </div>

      {dashLoading ? (
        <CardSkeleton />
      ) : (
        <RecentSubmissions items={recentActivity} />
      )}
    </div>
  );
}
