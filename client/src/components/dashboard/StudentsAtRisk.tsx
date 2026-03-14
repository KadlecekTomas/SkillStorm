"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Users } from "lucide-react";
import { useClassroomRiskOverview } from "@/hooks/use-classroom-risk-overview";
import { cn } from "@/utils/cn";

type PrimaryClass = {
  id: string;
  label: string;
  isHomeroom: boolean;
} | null;

type Props = {
  primaryClass: PrimaryClass;
  structureLoading: boolean;
};

function ScoreBar({ pct }: { pct: number }): React.JSX.Element {
  const fill =
    pct < 50 ? "bg-red-500" : pct < 70 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function scoreTextColor(pct: number): string {
  if (pct < 50) return "text-red-600 font-semibold";
  if (pct < 70) return "text-amber-600";
  return "text-green-600";
}

/**
 * Risk data is scoped to one class (primaryClass).
 * The scope is explicitly labeled in the card header to avoid implying full coverage.
 */
export function StudentsAtRisk({ primaryClass, structureLoading }: Props): React.JSX.Element {
  const router = useRouter();

  const { data: riskData, loading: riskLoading } = useClassroomRiskOverview(
    primaryClass?.id ?? null,
    !!primaryClass?.id,
  );

  const loading = structureLoading || riskLoading;

  const atRisk = riskData
    ? riskData.students
        .filter((s) => s.riskLevel !== "NONE")
        .sort((a, b) => a.averageScorePercent - b.averageScorePercent)
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white shadow-sm">
      {/* Section header — always shows which class the data covers */}
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Žáci potřebující pomoc
          </h3>
          {primaryClass && !loading && (
            <p className="mt-0.5 text-xs text-slate-400">
              {primaryClass.isHomeroom
                ? `třídní třída · ${primaryClass.label}`
                : `třída · ${primaryClass.label}`}
            </p>
          )}
        </div>
        {!loading && primaryClass && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() =>
              router.push(`/app/classrooms?highlight=${primaryClass.id}`)
            }
          >
            Zobrazit třídu →
          </button>
        )}
      </div>

      <div className="flex-1 p-3">
        {loading ? (
          <div className="space-y-4 px-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-1">
                <div className="h-3 w-32 rounded bg-slate-100" />
                <div className="h-1.5 w-full rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !primaryClass ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">Nemáte přiřazenou žádnou třídu.</p>
          </div>
        ) : atRisk.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-green-300" />
            <p className="text-sm text-slate-400">
              Žádní žáci z {primaryClass.label} nevyžadují pozornost.
            </p>
          </div>
        ) : (
          <ul>
            {atRisk.map((student) => (
              <li key={student.studentId}>
                <Link
                  href={`/app/students/${student.studentId}`}
                  className="flex flex-col gap-1 rounded-md px-3 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {student.displayName}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-sm tabular-nums",
                        scoreTextColor(student.averageScorePercent),
                      )}
                    >
                      {student.averageScorePercent.toFixed(0)} %
                    </span>
                  </div>
                  <ScoreBar pct={student.averageScorePercent} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
