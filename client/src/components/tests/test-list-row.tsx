"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type TestListRowProps = {
  testTitle: string;
  subjectName?: string | null;
  status: "done" | "open";
  lastScore?: number | null;
  lastMaxScore?: number | null;
  lastPercentage?: number | null;
  assignmentId: string;
  onOpen?: (assignmentId: string) => void;
  onViewResult?: (assignmentId: string) => void;
};

export function TestListRow({
  testTitle,
  subjectName,
  status,
  lastScore,
  lastMaxScore,
  lastPercentage,
  assignmentId,
  onOpen,
  onViewResult,
}: TestListRowProps) {
  const scoreLabel =
    lastScore != null && lastMaxScore != null && lastMaxScore > 0
      ? `${lastScore} / ${lastMaxScore} (${Math.round(lastPercentage ?? (lastScore / lastMaxScore) * 100)} %)`
      : "—";
  const statusLabel = status === "done" ? "Splněno" : "Otevřeno";

  return (
    <Card className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{testTitle}</h3>
          {subjectName != null && subjectName !== "" && (
            <Badge variant="neutral" className="mt-1">
              {subjectName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              status === "done"
                ? "text-xs font-medium text-emerald-600"
                : "text-xs font-medium text-slate-500"
            }
          >
            {statusLabel}
          </span>
          {status === "done" && (
            <span className="text-sm font-medium text-slate-700">
              {scoreLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {status === "open" && onOpen && (
          <Button size="sm" onClick={() => onOpen(assignmentId)}>
            Otevřít test
          </Button>
        )}
        {status === "done" && onViewResult && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewResult(assignmentId)}
          >
            Zobrazit výsledek
          </Button>
        )}
      </div>
    </Card>
  );
}
