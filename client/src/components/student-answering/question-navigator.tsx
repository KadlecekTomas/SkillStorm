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
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent",
        isCurrent
          ? "border-ink bg-ink text-white"
          : item.answered
            ? "border-accent/50 bg-accent-soft text-accent-deep hover:border-accent"
            : item.started
              ? "border-dashed border-ink-dim bg-canvas text-ink-muted hover:border-ink-muted"
              : "border-line bg-canvas text-ink-dim hover:border-line-strong",
      )}
    >
      {index + 1}
      {item.flagged && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-canvas bg-streak"
        />
      )}
      {item.pending && !item.flagged && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-canvas bg-streak motion-safe:animate-pulse"
        />
      )}
    </button>
  );
}

const LEGEND: Array<{ dot: string; label: string }> = [
  { dot: "bg-accent", label: "Zodpovězeno" },
  { dot: "bg-canvas border border-dashed border-ink-dim", label: "Rozepsaná" },
  { dot: "bg-canvas border border-line-strong", label: "Bez odpovědi" },
  { dot: "bg-streak", label: "K návratu / čeká na uložení" },
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
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-dim">
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
