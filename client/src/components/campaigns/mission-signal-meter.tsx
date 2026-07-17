"use client";

import type { JSX } from "react";
import type { LiveRoundOutcome } from "@/lib/api/live-sessions";
import { cn } from "@/utils/cn";

/*
 * „Síla signálu" — vizuální metr Mise během bleskovky.
 *
 * INVARIANT: hodnota metru roste POUZE s odehranými koly
 * (fraction = odehraná / celkem). Správnost posledního kola smí změnit
 * jen KOSMETIKU (barva/glow „stabilizace"), nikdy hodnotu — stejné
 * pravidlo jako XP a postup kampaně.
 */
export function MissionSignalMeter({
  fraction,
  lastOutcome,
  chapterTitle,
  className,
}: {
  /** 0..1 — podíl odehraných kol dnešní kapitoly. */
  fraction: number;
  lastOutcome: LiveRoundOutcome | null;
  chapterTitle: string;
  className?: string;
}): JSX.Element {
  const pct = Math.min(1, Math.max(0, fraction));
  const cells = 12;
  const lit = Math.round(pct * cells);
  const stabilized = lastOutcome === "MOSTLY_CORRECT";
  const noisy = lastOutcome === "MOSTLY_WRONG";

  return (
    <div
      data-testid="mission-signal"
      data-fraction={pct.toFixed(2)}
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-[rgb(var(--canvas))]/15 bg-[rgb(var(--canvas))]/5 px-4 py-2 font-mono",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--canvas))]/50">
        {chapterTitle}
      </span>
      <div className="flex flex-1 items-center gap-1" aria-hidden>
        {Array.from({ length: cells }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 flex-1 rounded-sm transition-all duration-500",
              i < lit
                ? stabilized
                  ? "bg-accent shadow-[0_0_8px_rgb(var(--accent))]"
                  : "bg-accent/80"
                : "bg-[rgb(var(--canvas))]/10",
              i < lit && noisy && "animate-pulse opacity-70",
            )}
          />
        ))}
      </div>
      <span
        data-testid="mission-signal-label"
        className="min-w-24 text-right text-sm font-bold text-[rgb(var(--canvas))]/80"
      >
        {stabilized && pct > 0 ? "STABILNÍ ✦ " : noisy && pct > 0 ? "ŠUM ▒ " : ""}
        {Math.round(pct * 100)} %
      </span>
    </div>
  );
}
