"use client";

import { Card } from "@/components/ui/card";
import type { AssignabilityReport } from "@/types/assignability";

export type TestHealthPanelProps = {
  report: AssignabilityReport;
};

function CheckItem({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <span className="text-emerald-600" aria-hidden>✔</span>
      ) : (
        <span className="text-red-600" aria-hidden>✖</span>
      )}
      <span className={ok ? "text-slate-700" : "text-slate-600"}>{label}</span>
    </div>
  );
}

export function TestHealthPanel({ report }: TestHealthPanelProps): React.JSX.Element {
  const hasNoQuestions = report.issues.some((i) => i.reason === "NO_QUESTIONS");
  const hasNoScore = report.issues.some((i) => i.reason === "NO_SCORE");
  const hasNoCorrectAnswer = report.issues.some(
    (i) => i.reason === "NO_CORRECT_ANSWER"
  );

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Stav testu</h2>
      <ul className="space-y-2">
        <li>
          <CheckItem
            ok={report.totalPoints > 0}
            label={
              report.totalPoints > 0
                ? `Celkem bodů: ${report.totalPoints}`
                : "Test nemá žádné body"
            }
          />
        </li>
        <li>
          <CheckItem
            ok={!hasNoQuestions}
            label={
              hasNoQuestions
                ? "Test neobsahuje žádné otázky"
                : "Test obsahuje otázky"
            }
          />
        </li>
        <li>
          <CheckItem
            ok={!hasNoScore}
            label={
              hasNoScore
                ? "Některé otázky nemají bodové hodnocení"
                : "Všechny otázky mají bodové hodnocení"
            }
          />
        </li>
        <li>
          <CheckItem
            ok={!hasNoCorrectAnswer}
            label={
              hasNoCorrectAnswer
                ? "Některé otázky nemají správnou odpověď"
                : "Všechny otázky mají správnou odpověď"
            }
          />
        </li>
      </ul>
    </Card>
  );
}
