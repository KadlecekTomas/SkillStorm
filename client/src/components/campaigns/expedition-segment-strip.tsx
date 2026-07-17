"use client";

import type { JSX } from "react";
import { PartakBlob } from "@/components/partak";
import { cn } from "@/utils/cn";

/**
 * Úsek dnešní cesty během bleskovky: od poslední zastávky k dnešnímu cíli.
 * Parťák poposkočí o krok po každém ODEHRANÉM kole (fraction = odehraná
 * kola / celkem kol) — čistě prezentační, správnost do pohybu nevstupuje.
 */
export function ExpeditionSegmentStrip({
  fromTitle,
  toTitle,
  fraction,
  className,
}: {
  fromTitle: string;
  toTitle: string;
  /** 0..1 — podíl odehraných kol dnešní bleskovky. */
  fraction: number;
  className?: string;
}): JSX.Element {
  const pct = Math.min(1, Math.max(0, fraction)) * 100;
  return (
    <div
      data-testid="expedition-strip"
      data-fraction={fraction.toFixed(2)}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-2 shadow-tactile-sm",
        className,
      )}
    >
      <span className="max-w-40 truncate text-sm font-bold text-ink-muted">
        {fromTitle}
      </span>
      <div className="relative h-10 flex-1">
        {/* stezka */}
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full border-t-4 border-dotted border-line-strong" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* parťák poskakuje po stezce */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-[26px] transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          <PartakBlob size={34} mood={pct > 0 ? "happy" : "idle"} />
        </div>
      </div>
      <span className="flex max-w-40 items-center gap-1 truncate text-sm font-bold text-accent-deep">
        <span aria-hidden>🚩</span> {toTitle}
      </span>
    </div>
  );
}
