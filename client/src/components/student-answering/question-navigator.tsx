"use client";

import type { JSX } from "react";
import { cn } from "@/utils/cn";

export interface QuestionNavItem {
  answered: boolean;
  flagged: boolean;
  /** Locally changed but not yet confirmed saved on the server. */
  pending: boolean;
  /** Visited but left without a (current) answer — "rozepsaná". */
  started: boolean;
}

export interface QuestionNavigatorProps {
  items: QuestionNavItem[];
  current: number;
  onSelect: (index: number) => void;
  /** Hide the legend in tight spaces (e.g. the mobile bottom sheet header). */
  showLegend?: boolean;
}

function NavDot({
  index,
  item,
  isCurrent,
  onSelect,
}: {
  index: number;
  item: QuestionNavItem;
  isCurrent: boolean;
  onSelect: (index: number) => void;
}): JSX.Element {
  const label = [
    `Otázka ${index + 1}`,
    item.answered
      ? "zodpovězeno"
      : item.started
        ? "rozepsaná, bez odpovědi"
        : "bez odpovědi",
    item.flagged ? "označeno k návratu" : null,
    item.pending ? "čeká na uložení" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-current={isCurrent ? "true" : undefined}
      aria-label={label}
      data-testid="question-nav-item"
      data-answered={item.answered}
      data-flagged={item.flagged}
      data-pending={item.pending}
      data-started={item.started}
      data-current={isCurrent}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500",
        isCurrent
          ? "border-slate-900 bg-slate-900 text-white"
          : item.answered
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
            : item.started
              ? "border-dashed border-slate-400 bg-white text-slate-700 hover:border-slate-500"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400",
      )}
    >
      {index + 1}
      {item.flagged && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-400"
        />
      )}
      {item.pending && !item.flagged && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-400 motion-safe:animate-pulse"
        />
      )}
    </button>
  );
}

const LEGEND: Array<{ dot: string; label: string }> = [
  { dot: "bg-emerald-400", label: "Zodpovězeno" },
  { dot: "bg-white border border-dashed border-slate-400", label: "Rozepsaná" },
  { dot: "bg-white border border-slate-300", label: "Bez odpovědi" },
  { dot: "bg-amber-400", label: "K návratu / čeká na uložení" },
];

export function QuestionNavigator({
  items,
  current,
  onSelect,
  showLegend = true,
}: QuestionNavigatorProps): JSX.Element {
  return (
    <div className="space-y-3">
      <nav aria-label="Navigace otázek" data-testid="question-navigator">
        <ol className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li key={i}>
              <NavDot
                index={i}
                item={item}
                isCurrent={i === current}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ol>
      </nav>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", l.dot)} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
