"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Users } from "lucide-react";

export type DiagnosticSnapshotData = {
  overallSuccessRate: number;
  trendPercent: number;
  assignmentCount: number;
  problematicTopic: {
    name: string;
    successRate: number;
    errorCount: number;
    /** Share of this topic's errors in total mistakes (0–100). */
    shareOfTotalMistakes?: number;
  } | null;
  studentsAtRiskCount: number;
  /** Count of students with declining trend (for "N students declining rapidly"). */
  studentsDecliningCount?: number;
};

type DiagnosticSnapshotProps = {
  data: DiagnosticSnapshotData | null;
  onViewStudents?: () => void;
  onViewTopicDetail?: (topicName: string) => void;
};

function TrendIndicator({ trend }: { trend: number }) {
  if (trend === 0) return <span className="text-sm text-slate-500">beze změny</span>;
  const isUp = trend > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${isUp ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {isUp ? "+" : ""}{trend}% (30 dní)
    </span>
  );
}

export function DiagnosticSnapshot({
  data,
  onViewStudents,
  onViewTopicDetail,
}: DiagnosticSnapshotProps): React.JSX.Element {
  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-2xl border border-slate-100 p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100" />
          </Card>
        ))}
      </div>
    );
  }

  const showBelowExpected = data.overallSuccessRate < 70;
  const showRapidDecline = data.trendPercent <= -10;
  const studentsDeclining = data.studentsDecliningCount ?? 0;
  const hasWorseningRisk = studentsDeclining > 0;

  return (
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Diagnostický přehled">
      <Card className="rounded-2xl border border-slate-100 p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Celková úspěšnost</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">
          {Math.round(data.overallSuccessRate)} %
        </p>
        <div className="mt-1">
          <TrendIndicator trend={data.trendPercent} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {data.assignmentCount} {data.assignmentCount === 1 ? "úkol" : "úkolů"}
        </p>
        {showBelowExpected && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Výkon třídy je pod očekávanou úrovní.
          </div>
        )}
        {showRapidDecline && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Rychlý pokles výkonu.
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border border-slate-100 p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Nejproblematičtější téma</p>
        {data.problematicTopic ? (
          <>
            <p className="mt-1 font-semibold text-slate-900">{data.problematicTopic.name}</p>
            <p className="text-sm text-slate-600">
              Úspěšnost {Math.round(data.problematicTopic.successRate)} % · {data.problematicTopic.errorCount} chyb
            </p>
            {data.problematicTopic.shareOfTotalMistakes != null && data.problematicTopic.shareOfTotalMistakes > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Představuje {Math.round(data.problematicTopic.shareOfTotalMistakes)} % všech chyb.
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="warning" className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Potřebuje pozornost
              </Badge>
              {onViewTopicDetail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewTopicDetail(data.problematicTopic!.name)}
                >
                  Detail tématu
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-slate-500">—</p>
        )}
      </Card>

      <Card className="rounded-2xl border border-slate-100 p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Žáci v riziku</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">{data.studentsAtRiskCount}</p>
        <p className="text-xs text-slate-500">pod 60 % celkové úspěšnosti</p>
        {hasWorseningRisk && (
          <p className="mt-1 flex items-center gap-1 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {studentsDeclining} {studentsDeclining === 1 ? "žák" : "žáci"} s klesajícím trendem
          </p>
        )}
        {onViewStudents && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={onViewStudents}
          >
            <Users className="h-4 w-4" />
            Zobrazit žáky
          </Button>
        )}
      </Card>
    </section>
  );
}
