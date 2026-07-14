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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-streak/40 bg-streak/10 px-6 py-5">
      <div className="flex items-start gap-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-streak" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-streak">
            Čeká na vyhodnocení
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink tabular-nums">
            {pendingSubmissions}
          </p>
          <p className="text-sm text-ink-muted">{pluralSubmissions(pendingSubmissions)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push("/app/results")}
        className="shrink-0 rounded-2xl bg-streak px-5 py-2.5 text-sm font-bold text-white shadow-tactile transition-all duration-100 [--tactile-shadow:#c25e00] hover:brightness-105 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-xp active:translate-y-[2px] active:shadow-tactile-pressed"
      >
        Přejít na vyhodnocení →
      </button>
    </div>
  );
}
