"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

type Props = {
  pendingSubmissions: number;
};

function pluralSubmissions(n: number): string {
  if (n === 1) return "odevzdání čeká na vyhodnocení";
  if (n >= 2 && n <= 4) return "odevzdání čekají na vyhodnocení";
  return "odevzdání čeká na vyhodnocení";
}

/**
 * Shown only when there are pending submissions — zero state is silent (no noise).
 * The prominent number makes the urgency immediately scannable.
 */
export function PendingTasks({ pendingSubmissions }: Props): React.JSX.Element | null {
  const router = useRouter();

  if (pendingSubmissions === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
      <div className="flex items-start gap-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Čeká na vyhodnocení
          </p>
          <p className="mt-1 text-3xl font-semibold text-amber-900 tabular-nums">
            {pendingSubmissions}
          </p>
          <p className="text-sm text-amber-700">{pluralSubmissions(pendingSubmissions)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push("/app/results")}
        className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
      >
        Přejít na vyhodnocení →
      </button>
    </div>
  );
}
