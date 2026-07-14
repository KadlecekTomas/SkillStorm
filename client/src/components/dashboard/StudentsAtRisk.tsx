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
    pct < 50 ? "bg-danger" : pct < 70 ? "bg-streak" : "bg-accent";
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function scoreTextColor(pct: number): string {
  if (pct < 50) return "text-danger font-bold";
  if (pct < 70) return "text-streak";
  return "text-accent-deep";
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
        .filter((s) => s.riskLevel !== "LOW")
        .sort((a, b) => a.averageScorePercent - b.averageScorePercent)
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-col rounded-xl border border-line bg-canvas-alt">
      {/* Section header — always shows which class the data covers */}
      <div className="flex items-start justify-between border-b border-line px-6 py-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
            Žáci potřebující pomoc
          </h3>
          {primaryClass && !loading && (
            <p className="mt-0.5 text-xs text-ink-dim">
              {primaryClass.isHomeroom
                ? `třídní třída · ${primaryClass.label}`
                : `třída · ${primaryClass.label}`}
            </p>
          )}
        </div>
        {!loading && primaryClass && (
          <button
            type="button"
            className="text-xs font-semibold text-ink-dim hover:text-ink"
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
                <div className="h-3 w-32 rounded bg-surface" />
                <div className="h-1.5 w-full rounded bg-surface" />
              </div>
            ))}
          </div>
        ) : !primaryClass ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-line-strong" />
            <p className="text-sm text-ink-dim">Nemáte přiřazenou žádnou třídu.</p>
          </div>
        ) : atRisk.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-accent/50" />
            <p className="text-sm text-ink-dim">
              Žádní žáci z {primaryClass.label} nevyžadují pozornost.
            </p>
          </div>
        ) : (
          <ul>
            {atRisk.map((student) => (
              <li key={student.studentId}>
                <Link
                  href={`/app/students/${student.studentId}`}
                  className="flex flex-col gap-1 rounded-lg px-3 py-3 transition-colors hover:bg-surface"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-ink truncate">
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
