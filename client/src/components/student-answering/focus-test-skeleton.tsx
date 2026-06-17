"use client";

import type { JSX } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for Focus Test Mode. Mirrors the real shell (sticky status bar +
 * question card + navigator rail) so the layout doesn't jump once the session loads.
 */
export function FocusTestSkeleton(): JSX.Element {
  return (
    <div
      data-testid="focus-test-skeleton"
      className="min-h-dvh bg-slate-50"
      aria-busy="true"
      aria-label="Spouštím test"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="mr-auto space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-44 rounded-xl" />
        </div>
        <div className="h-1 w-full bg-slate-100" />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-8">
          <div className="space-y-6">
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-3/4" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-11 w-28 rounded-2xl" />
              <Skeleton className="h-11 w-28 rounded-2xl" />
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-4 w-28" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-9 rounded-xl" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
