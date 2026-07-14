"use client";

type Props = {
  firstName: string;
  activeYearName: string | null;
  loading?: boolean;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Dobré ráno";
  if (h >= 12 && h < 18) return "Dobré odpoledne";
  if (h >= 18 && h < 22) return "Dobrý večer";
  return "Dobrou noc";
}

function getTodayLabel(): string {
  const raw = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Sticky context header — always anchors the teacher to who they are, what day it is,
 * and which academic year is active. Stays visible while scrolling.
 */
export function DashboardGreeting({ firstName, activeYearName, loading = false }: Props): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-canvas/95 px-1 py-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-3xl font-extrabold text-ink">
          {getGreeting()}, {loading ? "…" : firstName} 👋
        </h2>
        <p className="text-sm text-ink-dim">
          {getTodayLabel()}
          {activeYearName && (
            <>
              <span className="mx-2 text-line-strong">·</span>
              školní rok{" "}
              <span className="font-semibold text-ink-muted">{activeYearName}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
