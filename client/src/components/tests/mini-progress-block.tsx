"use client";

import { Card } from "@/components/ui/card";

export type MiniProgressBlockProps = {
  previousScore: number | null;
  currentScore: number | null;
};

export function MiniProgressBlock({
  previousScore,
  currentScore,
}: MiniProgressBlockProps): React.JSX.Element {
  const prev = previousScore != null ? Math.round(previousScore * 100) : null;
  const curr = currentScore != null ? Math.round(currentScore * 100) : null;
  const diff = prev != null && curr != null ? curr - prev : null;

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">
        Porovnání s předchozím pokusem
      </p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="text-slate-500">Předchozí skóre: </span>
          <span className="font-medium text-slate-800">
            {prev != null ? `${prev} %` : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Aktuální skóre: </span>
          <span className="font-medium text-slate-800">
            {curr != null ? `${curr} %` : "—"}
          </span>
        </div>
        {diff != null && (
          <div>
            <span className="text-slate-500">Rozdíl: </span>
            <span
              className={
                diff > 0
                  ? "font-medium text-emerald-600"
                  : diff < 0
                    ? "font-medium text-rose-600"
                    : "font-medium text-slate-600"
              }
            >
              {diff > 0 ? "+" : ""}
              {diff} %
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
