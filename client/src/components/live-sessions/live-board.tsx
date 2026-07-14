"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { PartakBlob, PartakEmblem } from "@/components/partak";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fromServerLiveAgeMode, type LiveAgeMode } from "@/config/live-age-mode";
import {
  finishLiveSession,
  getLiveSession,
  revealRound,
  setRoundOutcome,
  type LiveRoundOutcome,
  type LiveSessionFinishResult,
  type LiveSessionProjection,
  type RoundOptionKey,
} from "@/lib/api/live-sessions";
import { cn } from "@/utils/cn";

/*
 * Projekce Bleskovky — čitelnost z 8 metrů: otázka i možnosti používají
 * clamp() vázaný na šířku viewportu, ovládací prvky učitele jsou menší
 * (ovládá je zblízka). Věkový režim je čistě prezentační.
 */

/** Barvy a ikony dlaždic A–D — design tokeny (xp/accent/streak/danger). */
const OPTION_STYLE: Record<
  RoundOptionKey,
  { icon: string; bar: string; border: string }
> = {
  A: { icon: "▲", bar: "bg-xp", border: "border-xp" },
  B: { icon: "●", bar: "bg-accent", border: "border-accent" },
  C: { icon: "■", bar: "bg-streak", border: "border-streak" },
  D: { icon: "◆", bar: "bg-danger", border: "border-danger" },
};

const YOUNG_PARTAK_COMMENTS: Record<LiveRoundOutcome, string> = {
  MOSTLY_CORRECT: "Páni, vy jste třída šampionů!",
  SPLIT: "Půl napůl — příště to dáme všichni!",
  MOSTLY_WRONG: "Nevadí, z chyb se učíme nejvíc!",
};

const OUTCOME_BUTTONS: Array<{
  outcome: LiveRoundOutcome;
  label: string;
  emoji: string;
  className: string;
}> = [
  {
    outcome: "MOSTLY_CORRECT",
    label: "Většina správně",
    emoji: "🟢",
    className:
      "bg-accent text-white [--tactile-shadow:rgb(var(--accent-deep))] hover:bg-accent-hover",
  },
  {
    outcome: "SPLIT",
    label: "Půl napůl",
    emoji: "🟡",
    className:
      "bg-streak text-white [--tactile-shadow:rgb(var(--streak)/0.5)] hover:opacity-90",
  },
  {
    outcome: "MOSTLY_WRONG",
    label: "Většina špatně",
    emoji: "🔴",
    className:
      "bg-danger text-white [--tactile-shadow:rgb(var(--danger-deep))] hover:bg-danger-deep",
  },
];

interface LiveBoardProps {
  sessionId: string;
}

export function LiveBoard({ sessionId }: LiveBoardProps): JSX.Element {
  const router = useRouter();
  const [projection, setProjection] = useState<LiveSessionProjection | null>(
    null,
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [revealedKeys, setRevealedKeys] = useState<
    Record<string, RoundOptionKey>
  >({});
  const [lastOutcome, setLastOutcome] = useState<LiveRoundOutcome | null>(null);
  const [finish, setFinish] = useState<LiveSessionFinishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLiveSession(sessionId)
      .then((data) => {
        if (cancelled) return;
        setProjection(data);
        // obnovení projekce uprostřed hodiny: skoč na první neodehrané kolo
        const firstOpen = data.rounds.findIndex((r) => !r.completedAt);
        setRoundIndex(firstOpen === -1 ? data.rounds.length - 1 : firstOpen);
        const known: Record<string, RoundOptionKey> = {};
        for (const r of data.rounds) {
          if (r.correctKey) known[r.id] = r.correctKey;
        }
        setRevealedKeys(known);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Bleskovku se nepodařilo načíst.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const ageMode: LiveAgeMode = projection
    ? fromServerLiveAgeMode(projection.ageMode)
    : "middle";
  const rounds = projection?.rounds ?? [];
  const round = rounds[roundIndex] ?? null;
  const revealed = round ? (revealedKeys[round.id] ?? null) : null;
  const isLastRound = roundIndex >= rounds.length - 1;

  const streak = useMemo(() => {
    let count = 0;
    for (let i = roundIndex - 1; i >= 0; i -= 1) {
      const r = rounds[i];
      if (r?.outcome === "MOSTLY_CORRECT") count += 1;
      else break;
    }
    return count;
  }, [rounds, roundIndex]);

  // Odpočet: běží od zobrazení kola do revealu; young ho defaultně nemá.
  const countdownSec = projection?.countdownSec ?? null;
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!round || revealed || !countdownSec || finish) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(countdownSec);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [round?.id, revealed, countdownSec, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReveal = useCallback(async () => {
    if (!round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await revealRound(sessionId, round.id);
      setRevealedKeys((prev) => ({ ...prev, [round.id]: res.correctKey }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odhalení se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }, [round, busy, sessionId]);

  const handleOutcome = useCallback(
    async (outcome: LiveRoundOutcome) => {
      if (!round || busy) return;
      setBusy(true);
      setError(null);
      try {
        await setRoundOutcome(sessionId, round.id, outcome);
        setProjection((prev) =>
          prev
            ? {
                ...prev,
                rounds: prev.rounds.map((r) =>
                  r.id === round.id
                    ? { ...r, outcome, completedAt: new Date().toISOString() }
                    : r,
                ),
              }
            : prev,
        );
        setLastOutcome(outcome);
        if (!isLastRound) {
          setRoundIndex((i) => i + 1);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Výsledek se nepodařilo uložit.",
        );
      } finally {
        setBusy(false);
      }
    },
    [round, busy, sessionId, isLastRound],
  );

  const handleFinish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await finishLiveSession(sessionId);
      setFinish(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ukončení se nepodařilo.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, sessionId]);

  const senior = ageMode === "senior";
  const young = ageMode === "young";

  if (error && !projection) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorAlert title="Bleskovka" description={error} />
      </div>
    );
  }
  if (!projection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (projection.status === "FINISHED" && !finish) {
    return (
      <ShellFrame senior={senior}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <PartakEmblem size={72} />
          <h1 className="text-3xl font-extrabold">Bleskovka je ukončená</h1>
          <button
            type="button"
            className="rounded-2xl bg-accent px-8 py-3 font-bold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))]"
            onClick={() => router.push("/app")}
          >
            Zpět na přehled
          </button>
        </div>
      </ShellFrame>
    );
  }

  if (finish) {
    return (
      <FinishScreen
        finish={finish}
        ageMode={ageMode}
        testTitle={projection.testTitle}
        onExit={() => router.push("/app")}
      />
    );
  }

  const roundsDone = rounds.filter((r) => r.completedAt).length;
  const allDone = roundsDone === rounds.length && rounds.length > 0;

  return (
    <ShellFrame senior={senior}>
      <div
        data-testid="live-board"
        data-age-mode={ageMode}
        className="flex min-h-screen flex-col px-[4vw] py-6"
      >
        {/* Hlavička: sada + kolo + odpočet/streak */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {senior ? <PartakEmblem size={40} /> : null}
            <span
              className={cn(
                "text-lg font-bold",
                senior ? "text-[rgb(var(--canvas))]/80" : "text-ink-muted",
              )}
            >
              {projection.testTitle}
            </span>
          </div>
          <div className="flex items-center gap-5">
            {senior && streak > 0 ? (
              <span
                data-testid="live-streak"
                className="text-2xl font-extrabold text-streak"
              >
                🔥 {streak} v řadě
              </span>
            ) : null}
            {secondsLeft !== null ? (
              <span
                data-testid="live-countdown"
                className={cn(
                  "tabular-nums rounded-2xl border-2 px-4 py-1 text-3xl font-extrabold",
                  secondsLeft <= 5
                    ? "border-danger text-danger"
                    : senior
                      ? "border-[rgb(var(--canvas))]/30"
                      : "border-line-strong text-ink",
                )}
              >
                {secondsLeft}
              </span>
            ) : null}
            <span
              data-testid="live-round-counter"
              className={cn(
                "text-xl font-bold",
                senior ? "text-[rgb(var(--canvas))]/60" : "text-ink-dim",
              )}
            >
              Kolo {Math.min(roundIndex + 1, rounds.length)}/{rounds.length}
            </span>
          </div>
        </header>

        {round ? (
          <main className="flex flex-1 flex-col justify-center gap-[3vh]">
            <h1
              data-testid="live-question"
              className={cn(
                "text-center font-extrabold leading-tight",
                young
                  ? "text-[clamp(2.5rem,6vw,5rem)]"
                  : "text-[clamp(2rem,5vw,4.25rem)]",
              )}
            >
              {round.questionText}
            </h1>

            <div
              className={cn(
                "grid gap-[1.5vw]",
                round.options.length > 2 ? "grid-cols-2" : "grid-cols-2",
              )}
            >
              {round.options.map((option) => {
                const style = OPTION_STYLE[option.key];
                const isCorrect = revealed === option.key;
                const dimmed = revealed !== null && !isCorrect;
                return (
                  <div
                    key={option.key}
                    data-testid={`live-option-${option.key}`}
                    data-correct={isCorrect || undefined}
                    className={cn(
                      "flex items-center gap-[1.5vw] rounded-3xl border-4 px-[2vw] transition-all duration-300",
                      young ? "py-[4vh]" : "py-[3vh]",
                      senior
                        ? "bg-[rgb(var(--canvas))]/5"
                        : "bg-canvas shadow-tactile [--tactile-shadow:rgb(var(--line-strong))]",
                      style.border,
                      isCorrect &&
                        "scale-[1.02] border-accent ring-4 ring-accent bg-accent-soft text-ink",
                      dimmed && "opacity-30 grayscale",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center rounded-2xl font-extrabold text-white",
                        style.bar,
                        young
                          ? "h-[9vh] w-[9vh] text-[clamp(1.75rem,3.5vw,3rem)]"
                          : "h-[7vh] w-[7vh] text-[clamp(1.5rem,3vw,2.5rem)]",
                      )}
                      aria-hidden
                    >
                      {young ? style.icon : option.key}
                    </span>
                    <span
                      className={cn(
                        "font-extrabold",
                        young
                          ? "text-[clamp(1.75rem,3.5vw,3rem)]"
                          : "text-[clamp(1.4rem,2.8vw,2.4rem)]",
                      )}
                    >
                      {option.text}
                    </span>
                    {isCorrect ? (
                      <span
                        className="ml-auto text-[clamp(2rem,4vw,3.5rem)]"
                        aria-label="správná odpověď"
                      >
                        ✅
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </main>
        ) : null}

        {/* Parťák komentuje (young) */}
        {young ? (
          <div className="pointer-events-none fixed bottom-2 left-4 flex items-end gap-2">
            <PartakBlob size={96} mood={revealed ? "happy" : "idle"} />
            {revealed && lastOutcome ? (
              <span className="mb-6 max-w-56 rounded-2xl border border-line bg-canvas px-4 py-2 text-lg font-bold text-ink shadow-tactile-sm">
                {YOUNG_PARTAK_COMMENTS[lastOutcome]}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Ovládání učitele — menší, ovládá se zblízka */}
        <footer className="flex items-center justify-center gap-3 pb-2 pt-6">
          {error ? (
            <span className="text-sm font-semibold text-danger">{error}</span>
          ) : null}
          {round && !revealed ? (
            <button
              type="button"
              data-testid="live-reveal"
              disabled={busy}
              onClick={() => void handleReveal()}
              className="rounded-2xl bg-xp px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--xp)/0.5)] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
            >
              Odhalit odpověď
            </button>
          ) : null}
          {round && revealed && !round.completedAt ? (
            <div className="flex flex-wrap justify-center gap-3">
              {OUTCOME_BUTTONS.map((btn) => (
                <button
                  key={btn.outcome}
                  type="button"
                  data-testid={`live-outcome-${btn.outcome}`}
                  disabled={busy}
                  onClick={() => void handleOutcome(btn.outcome)}
                  className={cn(
                    "rounded-2xl px-8 py-4 text-lg font-extrabold shadow-tactile transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60",
                    btn.className,
                  )}
                >
                  {btn.emoji} {btn.label}
                </button>
              ))}
            </div>
          ) : null}
          {allDone ? (
            <button
              type="button"
              data-testid="live-finish"
              disabled={busy}
              onClick={() => void handleFinish()}
              className="rounded-2xl bg-accent px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
            >
              Ukončit bleskovku 🎉
            </button>
          ) : null}
        </footer>
      </div>
    </ShellFrame>
  );
}

/** Senior = tmavý quiz-night podklad v rámci tokenů; jinak světlý canvas. */
function ShellFrame({
  senior,
  children,
}: {
  senior: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "min-h-screen",
        senior
          ? "bg-[rgb(var(--ink))] text-[rgb(var(--canvas))]"
          : "bg-canvas-alt text-ink",
      )}
    >
      {children}
    </div>
  );
}

function FinishScreen({
  finish,
  ageMode,
  testTitle,
  onExit,
}: {
  finish: LiveSessionFinishResult;
  ageMode: LiveAgeMode;
  testTitle: string;
  onExit: () => void;
}): JSX.Element {
  const senior = ageMode === "senior";
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const partak = finish.partak;
  // XP bar v rámci aktuální stage (lineární prahy po 300 XP — viz server)
  const STAGE_STEP = 300;
  const stageFloor = partak ? (partak.stage - 1) * STAGE_STEP : 0;
  const prevPct = partak
    ? Math.max(0, ((finish.previousXp ?? 0) - stageFloor) / STAGE_STEP) * 100
    : 0;
  const newPct = partak
    ? Math.min(100, ((partak.xp - stageFloor) / STAGE_STEP) * 100)
    : 0;

  return (
    <ShellFrame senior={senior}>
      <div
        data-testid="live-finish-screen"
        className="flex min-h-screen flex-col items-center justify-center gap-[3vh] px-8 text-center"
      >
        <p
          className={cn(
            "text-xl font-bold",
            senior ? "text-[rgb(var(--canvas))]/60" : "text-ink-muted",
          )}
        >
          {testTitle}
        </p>
        <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold">
          Hotovo! 🎉
        </h1>
        <p className="text-2xl font-bold">
          Odehráno kol: {finish.playedRounds}
        </p>

        {partak ? (
          <div className="flex w-full max-w-2xl flex-col items-center gap-4">
            {ageMode === "young" ? (
              <PartakBlob size={160} mood="happy" />
            ) : (
              <PartakEmblem size={senior ? 88 : 120} />
            )}
            <p
              data-testid="live-xp-delta"
              className="text-[clamp(2rem,5vw,4rem)] font-extrabold text-xp"
            >
              +{finish.xpDelta} XP
            </p>
            <div className="h-6 w-full overflow-hidden rounded-full border-2 border-line-strong bg-surface">
              <div
                className="h-full rounded-full bg-xp transition-[width] duration-[1500ms] ease-out"
                style={{ width: `${animated ? newPct : prevPct}%` }}
              />
            </div>
            <p
              data-testid="live-partak-stage"
              className={cn(
                "text-xl font-bold",
                senior ? "text-[rgb(var(--canvas))]/80" : "text-ink-muted",
              )}
            >
              Třídní parťák · úroveň {partak.stage}
              {finish.stageUp ? " — NOVÁ ÚROVEŇ! 🚀" : ""}
            </p>
          </div>
        ) : (
          <p className="text-lg text-ink-muted">
            Bleskovka běžela bez třídy — parťák tentokrát XP nedostal.
          </p>
        )}

        <button
          type="button"
          data-testid="live-exit"
          onClick={onExit}
          className="mt-4 rounded-2xl bg-accent px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed"
        >
          Zpět na přehled
        </button>
      </div>
    </ShellFrame>
  );
}
