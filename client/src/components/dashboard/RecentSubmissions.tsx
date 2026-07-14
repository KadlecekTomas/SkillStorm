"use client";

import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { cn } from "@/utils/cn";

type ActivityItem = {
  id: string;
  testId: string;
  testTitle: string;
  studentName: string | null;
  score: number | null;
  status: string;
  submittedAt: string;
};

type Props = {
  items: ActivityItem[];
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `před ${days} ${days === 1 ? "dnem" : "dny"}`;
  if (hours > 0) return `před ${hours} hod`;
  if (mins > 1) return `před ${mins} min`;
  return "právě teď";
}

function scoreColor(score: number): string {
  if (score < 50) return "text-danger";
  if (score < 70) return "text-streak";
  return "text-accent-deep";
}

export function RecentSubmissions({ items }: Props): React.JSX.Element {
  const router = useRouter();
  const visible = items.slice(0, 6);

  return (
    <div className="rounded-xl border border-line bg-canvas-alt">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h3 className="text-xs font-bold uppercase tracking-[.08em] text-ink-dim">
          Poslední odevzdání
        </h3>
        {items.length > 6 && (
          <button
            type="button"
            className="text-xs font-semibold text-ink-dim hover:text-ink"
            onClick={() => router.push("/app/results")}
          >
            Zobrazit vše →
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ClipboardList className="h-8 w-8 text-line-strong" />
          <p className="text-sm text-ink-dim">Zatím žádné aktivity.</p>
        </div>
      ) : (
        <ul>
          {visible.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-6 py-3 transition-colors hover:bg-surface"
            >
              {/* Left: student + test */}
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  <span className="font-bold">
                    {item.studentName ?? "Anonymní žák"}
                  </span>
                  <span className="mx-1.5 text-line-strong">·</span>
                  {item.testTitle}
                </p>
                <p className="mt-0.5 text-xs text-ink-dim">
                  {relativeTime(item.submittedAt)}
                </p>
              </div>

              {/* Right: score or pending */}
              <div className="shrink-0 text-right">
                {item.score !== null ? (
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      scoreColor(item.score),
                    )}
                  >
                    {Math.round(item.score)} %
                  </span>
                ) : (
                  <span className="text-xs text-ink-dim">čeká na vyhodnocení</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
