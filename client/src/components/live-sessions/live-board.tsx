"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { PartakBlob, PartakEmblem } from "@/components/partak";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fromServerLiveAgeMode, type LiveAgeMode } from "@/config/live-age-mode";
import {
  castRoundVote,
  finishLiveSession,
  getLiveSession,
  openRoundVoting,
  revealRound,
  setRoundOutcome,
  type InteractiveSolution,
  type LiveRound,
  type LiveRoundOption,
  type LiveRoundOutcome,
  type LiveSessionFinishResult,
  type LiveSessionProjection,
  type RoundOptionKey,
  type RoundVoteCounts,
} from "@/lib/api/live-sessions";
import {
  InteractiveRoundBoard,
  useInteractiveRound,
} from "./interactive-rounds";
import {
  getCampaignProgress,
  type CampaignProgressDetail,
} from "@/lib/api/campaigns";
import { ExpeditionIntroOverlay } from "@/components/campaigns/expedition-intro-overlay";
import { ExpeditionSegmentStrip } from "@/components/campaigns/expedition-segment-strip";
import { ExpeditionFinishScene } from "@/components/campaigns/expedition-finish-scene";
import { MissionSignalMeter } from "@/components/campaigns/mission-signal-meter";
import { MissionFinishScene } from "@/components/campaigns/mission-finish-scene";
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

/** Mikro-hint prvního použití hlasování — localStorage, per zařízení. */
const VOTING_HINT_KEY = "skillstorm.live-voting-hint-seen";
/** Debounce proti dvojkliku dítěte — druhý tap téže dlaždice do 300 ms se zahodí. */
const VOTE_TAP_DEBOUNCE_MS = 300;
/** Long-press na dlaždici = −1 (oprava omylem přičteného hlasu). */
const VOTE_LONG_PRESS_MS = 550;

function sumVotes(counts: RoundVoteCounts | null | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}

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
  // Hlasování — anonymní agregáty, čistě per kolo (id → počty)
  const [votingOpen, setVotingOpen] = useState<Record<string, boolean>>({});
  const [votes, setVotes] = useState<Record<string, RoundVoteCounts>>({});
  const [autoOutcomes, setAutoOutcomes] = useState<
    Record<string, LiveRoundOutcome | null>
  >({});
  const [hintVisible, setHintVisible] = useState(false);
  const lastTapAtRef = useRef<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Kampaňová vrstva — čistě prezentační meziherní stav nad enginem session.
  const [campaign, setCampaign] = useState<CampaignProgressDetail | null>(null);
  const [introDismissed, setIntroDismissed] = useState(false);

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
        const openVoting: Record<string, boolean> = {};
        const knownVotes: Record<string, RoundVoteCounts> = {};
        for (const r of data.rounds) {
          if (r.correctKey) known[r.id] = r.correctKey;
          // refresh uprostřed hlasování: obnov fázi VOTING i počty
          if (r.votingStartedAt && !r.revealedAt) openVoting[r.id] = true;
          if (r.voteCounts) knownVotes[r.id] = r.voteCounts;
        }
        setRevealedKeys(known);
        setVotingOpen(openVoting);
        setVotes(knownVotes);
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

  // Detail kampaně pro mapu/úsek; refetch po finish (post-advance stav).
  const campaignProgressId = projection?.campaignProgressId ?? null;
  useEffect(() => {
    if (!campaignProgressId) return;
    let cancelled = false;
    getCampaignProgress(campaignProgressId)
      .then((detail) => {
        if (!cancelled) setCampaign(detail);
      })
      .catch(() => {
        /* kampaň je bonusová vrstva — bleskovka běží dál i bez ní */
      });
    return () => {
      cancelled = true;
    };
  }, [campaignProgressId, finish]);

  const ageMode: LiveAgeMode = projection
    ? fromServerLiveAgeMode(projection.ageMode)
    : "middle";
  const rounds = projection?.rounds ?? [];
  const round = rounds[roundIndex] ?? null;
  const isInteractive = round !== null && round.interactionType !== "QUIZ";
  const revealed = round ? (revealedKeys[round.id] ?? null) : null;
  const isLastRound = roundIndex >= rounds.length - 1;
  const isVotingOpen = round ? !revealed && (votingOpen[round.id] ?? false) : false;
  const roundVotes = round ? (votes[round.id] ?? null) : null;
  const totalVotes = sumVotes(roundVotes);
  /** Kolo prošlo hlasováním → reveal ukazuje graf místo dlaždic. */
  const hadVotes = revealed !== null && totalVotes > 0;

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
  // Interaktivní kola odpočet nemají — děti iterují vlastním tempem.
  const countdownSec = projection?.countdownSec ?? null;
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!round || revealed || !countdownSec || finish || isInteractive) {
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
  }, [round?.id, revealed, countdownSec, finish, isInteractive]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenVoting = useCallback(async () => {
    if (!round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await openRoundVoting(sessionId, round.id);
      setVotingOpen((prev) => ({ ...prev, [round.id]: true }));
      setVotes((prev) => ({ ...prev, [round.id]: res.voteCounts }));
      if (!window.localStorage.getItem(VOTING_HINT_KEY)) {
        setHintVisible(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Hlasování se nepodařilo otevřít.",
      );
    } finally {
      setBusy(false);
    }
  }, [round, busy, sessionId]);

  const dismissHint = useCallback(() => {
    window.localStorage.setItem(VOTING_HINT_KEY, "1");
    setHintVisible(false);
  }, []);

  const handleVote = useCallback(
    async (key: RoundOptionKey, delta: 1 | -1) => {
      if (!round) return;
      // debounce dvojkliku dítěte — jen pro +1, long-press oprava je záměrná
      const now = Date.now();
      if (delta === 1) {
        const last = lastTapAtRef.current[key] ?? 0;
        if (now - last < VOTE_TAP_DEBOUNCE_MS) return;
        lastTapAtRef.current[key] = now;
      }
      const roundId = round.id;
      // optimistický zápis (pop animace nesmí čekat na síť)…
      setVotes((prev) => {
        const current = prev[roundId] ?? {};
        const next = Math.max(0, (current[key] ?? 0) + delta);
        return { ...prev, [roundId]: { ...current, [key]: next } };
      });
      try {
        // …server je ale autorita — odpověď přepíše lokální počty
        const res = await castRoundVote(sessionId, roundId, key, delta);
        setVotes((prev) => ({ ...prev, [roundId]: res.voteCounts }));
      } catch {
        setVotes((prev) => {
          const current = prev[roundId] ?? {};
          const next = Math.max(0, (current[key] ?? 0) - delta);
          return { ...prev, [roundId]: { ...current, [key]: next } };
        });
      }
    },
    [round, sessionId],
  );

  const handleReveal = useCallback(async () => {
    if (!round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await revealRound(sessionId, round.id);
      // Kvízová cesta — interaktivní kola odhaluje interactive.handleRevealSolution
      const correctKey = res.correctKey;
      if (correctKey) {
        setRevealedKeys((prev) => ({ ...prev, [round.id]: correctKey }));
      }
      setVotingOpen((prev) => ({ ...prev, [round.id]: false }));
      if (res.voteCounts) {
        setVotes((prev) => ({ ...prev, [round.id]: res.voteCounts! }));
      }
      setAutoOutcomes((prev) => ({ ...prev, [round.id]: res.autoOutcome }));
      setHintVisible(false);
      // auto-outcome server rovnou persistoval → kolo je odehrané
      if (res.outcome) {
        const outcome = res.outcome;
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
      }
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

  /** Přepis auto-outcome jedním klepnutím — učitelovo slovo je finální. Bez posunu kola. */
  const handleOverrideOutcome = useCallback(
    async (outcome: LiveRoundOutcome) => {
      if (!round || busy || round.outcome === outcome) return;
      setBusy(true);
      setError(null);
      try {
        await setRoundOutcome(sessionId, round.id, outcome);
        setProjection((prev) =>
          prev
            ? {
                ...prev,
                rounds: prev.rounds.map((r) =>
                  r.id === round.id ? { ...r, outcome } : r,
                ),
              }
            : prev,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Výsledek se nepodařilo uložit.",
        );
      } finally {
        setBusy(false);
      }
    },
    [round, busy, sessionId],
  );

  const handleNextRound = useCallback(() => {
    if (!round) return;
    setLastOutcome(round.outcome);
    setRoundIndex((i) => Math.min(i + 1, rounds.length - 1));
  }, [round, rounds.length]);

  /** Dokončené interaktivní kolo (vyřešeno dětmi / Ukázat řešení). */
  const handleInteractiveCompleted = useCallback(
    (
      roundId: string,
      outcome: LiveRoundOutcome | null,
      solution: InteractiveSolution | null,
    ) => {
      setAutoOutcomes((prev) => ({ ...prev, [roundId]: outcome }));
      const now = new Date().toISOString();
      setProjection((prev) =>
        prev
          ? {
              ...prev,
              rounds: prev.rounds.map((r) =>
                r.id === roundId
                  ? {
                      ...r,
                      outcome: outcome ?? r.outcome,
                      completedAt: r.completedAt ?? now,
                      revealedAt: r.revealedAt ?? now,
                      ...(solution ? { solution } : {}),
                    }
                  : r,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const interactive = useInteractiveRound(
    sessionId,
    round,
    handleInteractiveCompleted,
  );

  // Fullscreen — tabule běží v prohlížeči; toggle přímo z plochy.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement
        .requestFullscreen()
        .catch(() => undefined);
    }
  }, []);

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
  const expedition = campaign?.campaignType === "EXPEDITION" ? campaign : null;
  const mission = campaign?.campaignType === "MISSION" ? campaign : null;
  // Mise má vlastní tmavou scénu (senior tón) bez ohledu na věkový režim.
  const darkShell = senior || mission !== null;

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
      <ShellFrame senior={darkShell}>
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
        campaign={campaign}
        onExit={() => router.push("/app")}
      />
    );
  }

  const roundsDone = rounds.filter((r) => r.completedAt).length;
  const allDone = roundsDone === rounds.length && rounds.length > 0;

  // Před bleskovkou: mapa ukáže, kde parťák stojí a kam dnes jde.
  if (
    expedition &&
    !introDismissed &&
    roundsDone === 0 &&
    projection.status === "RUNNING"
  ) {
    return (
      <ShellFrame senior={senior}>
        <ExpeditionIntroOverlay
          detail={expedition}
          onStart={() => setIntroDismissed(true)}
        />
      </ShellFrame>
    );
  }

  return (
    <ShellFrame senior={darkShell}>
      <div
        data-testid="live-board"
        data-age-mode={ageMode}
        className="flex min-h-screen flex-col px-[4vw] py-6"
      >
        {/* Hlavička: sada + kolo + odpočet/streak */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {darkShell ? <PartakEmblem size={40} /> : null}
            <span
              className={cn(
                "text-lg font-bold",
                darkShell ? "text-[rgb(var(--canvas))]/80" : "text-ink-muted",
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
                    : darkShell
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
                darkShell ? "text-[rgb(var(--canvas))]/60" : "text-ink-dim",
              )}
            >
              Kolo {Math.min(roundIndex + 1, rounds.length)}/{rounds.length}
            </span>
          </div>
        </header>

        {/* Výprava: parťák poposkočí o krok za každé ODEHRANÉ kolo */}
        {expedition && rounds.length > 0 ? (
          <ExpeditionSegmentStrip
            fromTitle={
              expedition.unlockedSteps.at(-1)?.content?.title ?? "Start"
            }
            toTitle={expedition.nextStep?.title ?? "Cíl výpravy"}
            fraction={roundsDone / rounds.length}
            className="mt-3"
          />
        ) : null}

        {/* Mise: signál roste s ODEHRANÝMI koly; správnost jen kosmetika */}
        {mission && rounds.length > 0 ? (
          <MissionSignalMeter
            fraction={roundsDone / rounds.length}
            lastOutcome={lastOutcome}
            chapterTitle={mission.nextStep?.title ?? "Kapitola"}
            className="mt-3"
          />
        ) : null}

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

            {isInteractive && round.content ? (
              <InteractiveRoundBoard
                round={round}
                api={interactive}
                ageMode={ageMode}
                dark={darkShell}
              />
            ) : isVotingOpen && roundVotes ? (
              <>
                {hintVisible ? (
                  <div
                    data-testid="live-voting-hint"
                    className={cn(
                      "mx-auto flex items-center gap-4 rounded-2xl border-2 border-line px-6 py-3 text-lg font-semibold",
                      darkShell
                        ? "border-[rgb(var(--canvas))]/25 text-[rgb(var(--canvas))]/80"
                        : "bg-canvas text-ink-muted",
                    )}
                  >
                    <span>
                      Hlasy jsou anonymní a nemají vliv na odměny — jen pro
                      váš přehled.
                    </span>
                    <button
                      type="button"
                      data-testid="live-voting-hint-dismiss"
                      onClick={dismissHint}
                      className="rounded-xl bg-accent px-4 py-1 font-bold text-white"
                    >
                      Rozumím
                    </button>
                  </div>
                ) : null}
                <VotingTiles
                  round={round}
                  counts={roundVotes}
                  totalVotes={totalVotes}
                  ageMode={ageMode}
                  dark={darkShell}
                  onVote={handleVote}
                />
              </>
            ) : revealed && hadVotes ? (
              <VoteChart
                round={round}
                counts={roundVotes ?? {}}
                totalVotes={totalVotes}
                correctKey={revealed}
                ageMode={ageMode}
                dark={darkShell}
              />
            ) : (
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
                    // klíč per kolo: recyklovaný DOM node by 300ms přeléval
                    // zvýraznění správné odpovědi minulého kola do nové otázky
                    key={`${round.id}-${option.key}`}
                    data-testid={`live-option-${option.key}`}
                    data-correct={isCorrect || undefined}
                    className={cn(
                      "flex items-center gap-[1.5vw] rounded-3xl border-4 px-[2vw] transition-all duration-300",
                      young ? "py-[4vh]" : "py-[3vh]",
                      darkShell
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
            )}
          </main>
        ) : null}

        {/* Parťák (young) — komentuje výsledek minulého kola, dokud se neodhalí další */}
        {young ? (
          <div className="pointer-events-none fixed bottom-2 left-4 flex items-end gap-2">
            <PartakBlob size={96} mood={lastOutcome ? "happy" : "idle"} />
            {!revealed && lastOutcome ? (
              <span className="mb-6 max-w-56 rounded-2xl border border-line bg-canvas px-4 py-2 text-lg font-bold text-ink shadow-tactile-sm">
                {YOUNG_PARTAK_COMMENTS[lastOutcome]}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Ovládací pruh — vše dosažitelné dotykem z plochy, targety 80px+ */}
        <footer
          data-testid="live-control-bar"
          className="flex min-h-[96px] items-center justify-center gap-3 pb-2 pt-6"
        >
          {error || interactive.error ? (
            <span className="text-sm font-semibold text-danger">
              {error ?? interactive.error}
            </span>
          ) : null}
          {isInteractive && round && !round.completedAt ? (
            <>
              {round.content?.kind === "ORDER" ? (
                <button
                  type="button"
                  data-testid="live-check-order"
                  disabled={interactive.checking}
                  onClick={() => void interactive.handleCheck()}
                  className="min-h-[80px] rounded-2xl bg-accent px-12 py-4 text-2xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
                >
                  {interactive.checking ? "Kontroluji…" : "Zkontrolovat ✓"}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="live-show-solution"
                onClick={() => void interactive.handleRevealSolution()}
                className={cn(
                  "min-h-[80px] rounded-2xl border-2 px-8 py-4 text-lg font-bold transition-all",
                  darkShell
                    ? "border-[rgb(var(--canvas))]/30 text-[rgb(var(--canvas))]/80"
                    : "border-line-strong bg-canvas text-ink-muted",
                )}
              >
                Ukázat řešení
              </button>
            </>
          ) : null}
          {isInteractive && round?.completedAt ? (
            <>
              <OutcomeBadges
                current={round.outcome}
                auto={autoOutcomes[round.id] ?? null}
                autoLabel="Podle průběhu:"
                busy={busy}
                dark={darkShell}
                onOverride={handleOverrideOutcome}
              />
              {!isLastRound ? (
                <button
                  type="button"
                  data-testid="live-next-round"
                  disabled={busy}
                  onClick={handleNextRound}
                  className="min-h-[80px] rounded-2xl bg-xp px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--xp)/0.5)] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
                >
                  Další kolo →
                </button>
              ) : null}
            </>
          ) : null}
          {!isInteractive && round && !revealed && !isVotingOpen ? (
            <>
              <button
                type="button"
                data-testid="live-vote-open"
                disabled={busy}
                onClick={() => void handleOpenVoting()}
                className="rounded-2xl bg-accent px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
              >
                🗳️ Hlasujeme!
              </button>
              <button
                type="button"
                data-testid="live-vote-skip"
                disabled={busy}
                onClick={() => void handleReveal()}
                className={cn(
                  "rounded-2xl border-2 px-8 py-4 text-lg font-bold transition-all disabled:opacity-60",
                  darkShell
                    ? "border-[rgb(var(--canvas))]/30 text-[rgb(var(--canvas))]/80"
                    : "border-line-strong bg-canvas text-ink-muted",
                )}
              >
                Přeskočit hlasování
              </button>
            </>
          ) : null}
          {!isInteractive && round && isVotingOpen ? (
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
          {round && revealed && round.completedAt && hadVotes ? (
            <OutcomeBadges
              current={round.outcome}
              auto={autoOutcomes[round.id] ?? null}
              busy={busy}
              dark={darkShell}
              onOverride={handleOverrideOutcome}
            />
          ) : null}
          {round && round.completedAt && hadVotes && !isLastRound ? (
            <button
              type="button"
              data-testid="live-next-round"
              disabled={busy}
              onClick={handleNextRound}
              className="rounded-2xl bg-xp px-10 py-4 text-xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--xp)/0.5)] transition-all active:translate-y-[2px] active:shadow-tactile-pressed disabled:opacity-60"
            >
              Další kolo →
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
              {senior ? "Vyhodnotit" : "Ukončit bleskovku 🎉"}
            </button>
          ) : null}
          {/* Fullscreen — tabule běží v prohlížeči, toggle přímo z plochy */}
          <button
            type="button"
            data-testid="live-fullscreen-toggle"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen ? "Ukončit celou obrazovku" : "Na celou obrazovku"
            }
            className={cn(
              "ml-2 flex min-h-[80px] min-w-[80px] items-center justify-center rounded-2xl border-2 text-3xl transition-all",
              darkShell
                ? "border-[rgb(var(--canvas))]/30 text-[rgb(var(--canvas))]/80"
                : "border-line-strong bg-canvas text-ink-muted",
            )}
          >
            {isFullscreen ? "⤢" : "⛶"}
          </button>
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

/**
 * Fáze VOTING — dotyková tabule. Dlaždice přes celou plochu (touch target
 * mnohem víc než 120px), tap = +1 s pop animací čísla, long-press = −1
 * (oprava omylu). Žádný hover pattern — děti hladí sklo, ne myš.
 */
function VotingTiles({
  round,
  counts,
  totalVotes,
  ageMode,
  dark,
  onVote,
}: {
  round: LiveRound;
  counts: RoundVoteCounts;
  totalVotes: number;
  ageMode: LiveAgeMode;
  dark: boolean;
  onVote: (key: RoundOptionKey, delta: 1 | -1) => void;
}): JSX.Element {
  return (
    <div data-testid="live-voting" className="flex flex-1 flex-col gap-[2vh]">
      <div className="grid flex-1 grid-cols-2 gap-[1.5vw]">
        {round.options.map((option) => (
          <VoteTile
            key={`${round.id}-${option.key}`}
            option={option}
            count={counts[option.key] ?? 0}
            ageMode={ageMode}
            dark={dark}
            onVote={onVote}
          />
        ))}
      </div>
      <p
        data-testid="live-vote-total"
        className={cn(
          "text-center text-xl font-bold",
          dark ? "text-[rgb(var(--canvas))]/60" : "text-ink-muted",
        )}
      >
        Hlasů: <span className="tabular-nums">{totalVotes}</span>
      </p>
    </div>
  );
}

function VoteTile({
  option,
  count,
  ageMode,
  dark,
  onVote,
}: {
  option: LiveRoundOption;
  count: number;
  ageMode: LiveAgeMode;
  dark: boolean;
  onVote: (key: RoundOptionKey, delta: 1 | -1) => void;
}): JSX.Element {
  const young = ageMode === "young";
  const senior = ageMode === "senior";
  const style = OPTION_STYLE[option.key];
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <button
      type="button"
      data-testid={`live-vote-tile-${option.key}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => {
        longPressFired.current = false;
        clearTimer();
        pressTimer.current = setTimeout(() => {
          longPressFired.current = true;
          onVote(option.key, -1);
        }, VOTE_LONG_PRESS_MS);
      }}
      onPointerUp={() => {
        clearTimer();
        if (!longPressFired.current) onVote(option.key, 1);
      }}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      className={cn(
        "flex min-h-[120px] touch-manipulation select-none flex-col items-center justify-center gap-[1vh] rounded-3xl border-4 px-[2vw] py-[3vh] transition-transform active:scale-[0.98]",
        senior
          ? dark
            ? "border-[rgb(var(--canvas))]/25 bg-[rgb(var(--canvas))]/5"
            : "border-line-strong bg-canvas"
          : young
            ? cn(style.bar, "border-transparent text-white")
            : cn(
                style.border,
                dark ? "bg-[rgb(var(--canvas))]/5" : "bg-canvas shadow-tactile [--tactile-shadow:rgb(var(--line-strong))]",
              ),
      )}
    >
      <span className="flex items-center gap-[1vw]">
        {senior ? (
          <span className="text-[clamp(1.25rem,2vw,1.75rem)] font-bold opacity-60">
            {option.key}
          </span>
        ) : (
          <span
            className={cn(
              "flex items-center justify-center rounded-2xl font-extrabold",
              young
                ? "h-[8vh] w-[8vh] bg-white/25 text-[clamp(2rem,4vw,3.5rem)]"
                : cn(style.bar, "h-[6vh] w-[6vh] text-white text-[clamp(1.25rem,2.5vw,2rem)]"),
            )}
            aria-hidden
          >
            {young ? style.icon : option.key}
          </span>
        )}
        <span
          className={cn(
            "font-extrabold",
            young
              ? "text-[clamp(1.75rem,3.2vw,2.8rem)]"
              : "text-[clamp(1.3rem,2.4vw,2rem)]",
          )}
        >
          {option.text}
        </span>
      </span>
      {/* key={count}: remount čísla → pop animace při každém hlasu */}
      <span
        key={count}
        data-testid={`live-vote-count-${option.key}`}
        className={cn(
          "animate-pop tabular-nums font-extrabold",
          senior
            ? "font-mono text-[clamp(2.5rem,5vw,4.5rem)]"
            : "text-[clamp(3rem,7vw,6rem)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Reveal kola s hlasováním — sloupcový graf. Správná možnost se obarví
 * AŽ TADY (před revealem graf správnost nezná — klíč nebyl na klientu).
 */
function VoteChart({
  round,
  counts,
  totalVotes,
  correctKey,
  ageMode,
  dark,
}: {
  round: LiveRound;
  counts: RoundVoteCounts;
  totalVotes: number;
  correctKey: RoundOptionKey;
  ageMode: LiveAgeMode;
  dark: boolean;
}): JSX.Element {
  const senior = ageMode === "senior";
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(1, ...round.options.map((o) => counts[o.key] ?? 0));

  return (
    <div data-testid="live-vote-chart" className="flex flex-col gap-[2vh]">
      <div className="flex h-[36vh] items-end justify-center gap-[3vw]">
        {round.options.map((option) => {
          const value = counts[option.key] ?? 0;
          const isCorrect = option.key === correctKey;
          const style = OPTION_STYLE[option.key];
          return (
            <div
              key={`${round.id}-${option.key}`}
              data-testid={`live-vote-bar-${option.key}`}
              data-correct={isCorrect || undefined}
              className={cn(
                "flex h-full w-[14vw] flex-col items-center justify-end gap-2 transition-opacity duration-500",
                !isCorrect && "opacity-40 grayscale",
              )}
            >
              <span
                className={cn(
                  "tabular-nums font-extrabold",
                  senior
                    ? "font-mono text-[clamp(1.75rem,3vw,2.75rem)]"
                    : "text-[clamp(2rem,3.5vw,3rem)]",
                )}
              >
                {value}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-2xl transition-[height] duration-700 ease-out",
                  style.bar,
                  isCorrect && "ring-4 ring-accent",
                )}
                style={{
                  height: grown ? `${Math.max(4, (value / max) * 100)}%` : "4%",
                }}
              />
              <span
                className={cn(
                  "flex items-center gap-2 text-[clamp(1rem,1.6vw,1.4rem)] font-bold",
                  dark ? "text-[rgb(var(--canvas))]/80" : "text-ink",
                )}
              >
                {option.key} · {option.text}
                {isCorrect ? <span aria-label="správná odpověď">✅</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <p
        data-testid="live-vote-total"
        className={cn(
          "text-center text-xl font-bold",
          dark ? "text-[rgb(var(--canvas))]/60" : "text-ink-muted",
        )}
      >
        Celkem hlasů: <span className="tabular-nums">{totalVotes}</span>
      </p>
    </div>
  );
}

/**
 * Outcome badge po revealu s hlasy — předvyplněný z auto-výpočtu, učitel
 * může jedním klepnutím přepsat (jeho slovo je finální).
 */
function OutcomeBadges({
  current,
  auto,
  autoLabel = "Podle hlasů:",
  busy,
  dark,
  onOverride,
}: {
  current: LiveRoundOutcome | null;
  auto: LiveRoundOutcome | null;
  /** Popisek auto-outcome — hlasy (kvíz) vs. průběh (interaktivní kola). */
  autoLabel?: string;
  busy: boolean;
  dark: boolean;
  onOverride: (outcome: LiveRoundOutcome) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span
        className={cn(
          "mr-1 text-sm font-semibold",
          dark ? "text-[rgb(var(--canvas))]/60" : "text-ink-dim",
        )}
      >
        {auto && current === auto ? autoLabel : "Výsledek:"}
      </span>
      {OUTCOME_BUTTONS.map((btn) => {
        const active = current === btn.outcome;
        return (
          <button
            key={btn.outcome}
            type="button"
            data-testid={`live-outcome-badge-${btn.outcome}`}
            data-active={active || undefined}
            disabled={busy}
            onClick={() => onOverride(btn.outcome)}
            className={cn(
              "rounded-2xl px-4 py-2 text-base font-extrabold transition-all disabled:opacity-60",
              active
                ? cn(btn.className, "shadow-tactile")
                : cn(
                    "border-2 opacity-70",
                    dark
                      ? "border-[rgb(var(--canvas))]/30 text-[rgb(var(--canvas))]/80"
                      : "border-line-strong bg-canvas text-ink-muted",
                  ),
            )}
          >
            {btn.emoji} {btn.label}
          </button>
        );
      })}
    </div>
  );
}

function FinishScreen({
  finish,
  ageMode,
  testTitle,
  campaign,
  onExit,
}: {
  finish: LiveSessionFinishResult;
  ageMode: LiveAgeMode;
  testTitle: string;
  campaign: CampaignProgressDetail | null;
  onExit: () => void;
}): JSX.Element {
  const senior = ageMode === "senior";
  // Mise končí ve své tmavé scéně i mimo senior režim.
  const dark = senior || campaign?.campaignType === "MISSION";
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
    <ShellFrame senior={dark}>
      <div
        data-testid="live-finish-screen"
        className="flex min-h-screen flex-col items-center justify-center gap-[3vh] px-8 text-center"
      >
        <p
          className={cn(
            "text-xl font-bold",
            dark ? "text-[rgb(var(--canvas))]/60" : "text-ink-muted",
          )}
        >
          {testTitle}
        </p>
        {/* Senior: žádné konfety, věcný quiz-night tón */}
        <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold">
          {dark ? "Konec hry" : "Hotovo! 🎉"}
        </h1>
        <p className="text-2xl font-bold">
          Odehráno kol: {finish.playedRounds}
        </p>

        {/* Výprava: scéna nálezu — zastávka, samolepka, háček na příště */}
        {finish.campaignAdvance &&
        campaign &&
        campaign.campaignType === "EXPEDITION" ? (
          <ExpeditionFinishScene
            detail={campaign}
            advance={finish.campaignAdvance}
          />
        ) : null}

        {/* Mise: fragment + cliffhanger + POKRAČOVÁNÍ PŘÍŠTĚ */}
        {finish.campaignAdvance &&
        campaign &&
        campaign.campaignType === "MISSION" ? (
          <MissionFinishScene
            detail={campaign}
            advance={finish.campaignAdvance}
          />
        ) : null}

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
                dark ? "text-[rgb(var(--canvas))]/80" : "text-ink-muted",
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
