"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type TestDetailSummaryProps = {
  testTitle: string;
  subjectName?: string | null;
  score: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  submittedAt: string | null;
  attemptNo: number;
};

export function TestDetailSummary({
  testTitle,
  subjectName,
  score,
  maxScore,
  percentage,
  submittedAt,
  attemptNo,
}: TestDetailSummaryProps): React.JSX.Element {
  const scoreLabel =
    score != null && maxScore != null && maxScore > 0
      ? `${score} / ${maxScore} (${Math.round(percentage ?? (score / maxScore) * 100)} %)`
      : "—";
  const dateLabel = submittedAt
    ? new Date(submittedAt).toLocaleString("cs-CZ", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  return (
    <Card className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{testTitle}</h1>
          {subjectName != null && subjectName !== "" && (
            <Badge variant="neutral">{subjectName}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Skóre</p>
            <p className="font-semibold text-slate-900">{scoreLabel}</p>
          </div>
          <div>
            <p className="text-slate-500">Odevzdáno</p>
            <p className="font-medium text-slate-800">{dateLabel}</p>
          </div>
          <div>
            <p className="text-slate-500">Pokus</p>
            <p className="font-medium text-slate-800">{attemptNo}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
