"use client";

/*
 * Interaktivní kola bleskovky — MATCH_PAIRS / ORDER / SORT_BINS.
 *
 * Latence školní wifi (roundtrip 200–500 ms na každý tah):
 * - Po puštění kartička ZŮSTANE usazená v drop zóně s jemným pulzem
 *   (pending) — žádný spinner. Verdikt dokreslí odpověď serveru:
 *   pop + usazení (správně) / zatřesení a návrat (špatně).
 * - Tahy se nefrontují: každá kartička má vlastní pending stav, další dítě
 *   táhne dál, i když předchozí odpověď ještě letí. Iterace, ne verdikt.
 * - Řešení NENÍ na klientu — soudí server (viz submitRoundAttempt).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { PartakBlob } from "@/components/partak";
import type { LiveAgeMode } from "@/config/live-age-mode";
import {
  submitRoundAttempt,
  revealRound,
  type BoardCard,
  type InteractiveBoardContent,
  type InteractiveSolution,
  type LiveRound,
  type LiveRoundOutcome,
} from "@/lib/api/live-sessions";
import { DragCard, DropZone, TouchDndBoard, type CardState } from "./touch-dnd";
import { cn } from "@/utils/cn";

/**
 * Barvy kartiček (young) — cyklují přes design tokeny. Záměrně BEZ danger:
 * červená by na kartičce četla jako „chyba", tady je barva jen identitou.
 */
const CARD_FILL = ["bg-xp", "bg-accent", "bg-streak"] as const;
const CARD_ICONS = ["▲", "●", "■", "◆", "★", "⬟", "⬢", "♥", "☀", "☾"] as const;

/** Po dokončení kola: krátká oslava, pak zpět na plochu s výsledkem. */
const CELEBRATION_MS = 2400;

export interface InteractiveRoundApi {
  /** false = kolo je QUIZ / žádné — plocha se nerenderuje. */
  active: boolean;
  /** Server-potvrzená umístění (klíč → cíl, stejný tvar jako attemptStats.placed). */
  placed: Record<string, string>;
  /** Usazené v zóně, čekají na soud serveru — jemný pulz. */
  pending: Record<string, string>;
  /** Právě se třesou (špatný verdikt) — po animaci se vrátí. */
  wrong: Record<string, string>;
  /** ORDER: aktuální pořadí řady (round-local ids). */
  arrangement: string[];
  /** ORDER: maska poslední kontroly (po pozicích), null před první. */
  mask: boolean[] | null;
  checking: boolean;
  solved: boolean;
  celebration: LiveRoundOutcome | null;
  solution: InteractiveSolution | null;
  error: string | null;
  handleDrop: (draggedId: string, zoneId: string) => void;
  clearWrong: (key: string) => void;
  handleCheck: () => Promise<void>;
  /** Učitelská pojistka „Ukázat řešení" — server kolo dokončí a vrátí řešení. */
  handleRevealSolution: () => Promise<void>;
}

const INACTIVE_API: InteractiveRoundApi = {
  active: false,
  placed: {},
  pending: {},
  wrong: {},
  arrangement: [],
  mask: null,
  checking: false,
  solved: false,
  celebration: null,
  solution: null,
  error: null,
  handleDrop: () => undefined,
  clearWrong: () => undefined,
  handleCheck: async () => undefined,
  handleRevealSolution: async () => undefined,
};

export function useInteractiveRound(
  sessionId: string,
  round: LiveRound | null,
  onCompleted: (
    roundId: string,
    outcome: LiveRoundOutcome | null,
    solution: InteractiveSolution | null,
  ) => void,
): InteractiveRoundApi {
  const content = round?.content ?? null;
  const roundId = round?.id ?? null;
  const isInteractive = round !== null && round.interactionType !== "QUIZ";

  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<Record<string, string>>({});
  const [arrangement, setArrangement] = useState<string[]>([]);
  const [mask, setMask] = useState<boolean[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [solved, setSolved] = useState(false);
  const [celebration, setCelebration] = useState<LiveRoundOutcome | null>(null);
  const [solution, setSolution] = useState<InteractiveSolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset + obnova stavu při přepnutí kola (refresh mid-round: placed ze
  // serverových attemptStats, dokončené kolo rovnou s řešením).
  useEffect(() => {
    setPending({});
    setWrong({});
    setMask(null);
    setChecking(false);
    setCelebration(null);
    setError(null);
    if (!round || !isInteractive || !content) {
      setPlaced({});
      setArrangement([]);
      setSolved(false);
      setSolution(null);
      return;
    }
    setPlaced(round.attemptStats?.placed ?? {});
    setSolved(round.completedAt !== null);
    setSolution(round.solution ?? null);
    if (content.kind === "ORDER") {
      // Dokončené kolo ukazuje správné pořadí, běžící zamíchanou řadu.
      if (round.completedAt && round.solution && "order" in round.solution) {
        setArrangement(round.solution.order);
      } else {
        setArrangement(content.items.map((i) => i.id));
      }
    } else {
      setArrangement([]);
    }
  }, [roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    },
    [],
  );

  const finishRound = useCallback(
    (
      outcome: LiveRoundOutcome | null,
      solutionValue: InteractiveSolution | null,
    ) => {
      if (!roundId) return;
      setSolved(true);
      setSolution(solutionValue);
      if (solutionValue && "order" in solutionValue) {
        setArrangement(solutionValue.order);
      }
      setCelebration(outcome ?? "MOSTLY_CORRECT");
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(
        () => setCelebration(null),
        CELEBRATION_MS,
      );
      onCompleted(roundId, outcome, solutionValue);
    },
    [roundId, onCompleted],
  );

  /**
   * PLACE tah (MATCH_PAIRS/SORT_BINS). Neblokující: kartička jde do pending
   * a request letí; další tahy se nefrontují za odpovědí.
   */
  const handleDrop = useCallback(
    (draggedId: string, zoneId: string) => {
      if (!roundId || !content || solved) return;
      // Server drží placed pod klíčem „levé strany": MATCH = leftId (zóna),
      // SORT = cardId (tažená kartička).
      const key = content.kind === "MATCH_PAIRS" ? zoneId : draggedId;
      const value = content.kind === "MATCH_PAIRS" ? draggedId : zoneId;
      if (placed[key] || pending[key] || wrong[key]) return;
      // MATCH: pravá kartička už visí v jiné zóně → ignorovat
      if (
        content.kind === "MATCH_PAIRS" &&
        [...Object.values(placed), ...Object.values(pending)].includes(
          draggedId,
        )
      ) {
        return;
      }
      setError(null);
      setPending((prev) => ({ ...prev, [key]: value }));

      const attempt =
        content.kind === "MATCH_PAIRS"
          ? ({ kind: "PLACE", itemId: zoneId, targetId: draggedId } as const)
          : ({ kind: "PLACE", itemId: draggedId, targetId: zoneId } as const);

      void submitRoundAttempt(sessionId, roundId, attempt)
        .then((res) => {
          setPending((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (res.alreadyCompleted) {
            finishRound(res.outcome, res.solution ?? null);
            return;
          }
          if (res.correct) {
            setPlaced((prev) => ({ ...prev, [key]: value }));
            if (res.solved) {
              finishRound(res.outcome, res.solution ?? null);
            }
          } else {
            // Zatřese a vrátí — animace, žádná červená hanba.
            setWrong((prev) => ({ ...prev, [key]: value }));
          }
        })
        .catch(() => {
          // Síťová chyba ≠ špatná odpověď: kartička se tiše vrátí bez shake.
          setPending((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setError("Tabule ztratila spojení — zkuste tah znovu.");
        });
    },
    [roundId, content, solved, placed, pending, wrong, sessionId, finishRound],
  );

  const clearWrong = useCallback((key: string) => {
    setWrong((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** ORDER: lokální prohození dvou kartiček v řadě (bez serveru). */
  const swapCards = useCallback((draggedId: string, zoneId: string) => {
    setMask(null);
    setArrangement((prev) => {
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(zoneId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next[from] = zoneId;
      next[to] = draggedId;
      return next;
    });
  }, []);

  const orderAwareDrop = useCallback(
    (draggedId: string, zoneId: string) => {
      if (content?.kind === "ORDER") {
        if (!solved && !checking) swapCards(draggedId, zoneId);
        return;
      }
      handleDrop(draggedId, zoneId);
    },
    [content?.kind, solved, checking, swapCards, handleDrop],
  );

  /** ORDER: Zkontrolovat — jeden request, špatné pozice se zatřesou. */
  const handleCheck = useCallback(async () => {
    if (!roundId || content?.kind !== "ORDER" || solved || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await submitRoundAttempt(sessionId, roundId, {
        kind: "CHECK",
        arrangement,
      });
      if (res.alreadyCompleted || res.solved) {
        setMask(null);
        finishRound(res.outcome, res.solution ?? null);
        return;
      }
      const resultMask = res.mask ?? null;
      setMask(resultMask);
      if (resultMask) {
        const wrongEntries: Record<string, string> = {};
        arrangement.forEach((cardId, i) => {
          if (!resultMask[i]) wrongEntries[cardId] = cardId;
        });
        setWrong((prev) => ({ ...prev, ...wrongEntries }));
      }
    } catch {
      setError("Kontrola se nepovedla — zkuste to znovu.");
    } finally {
      setChecking(false);
    }
  }, [roundId, content?.kind, solved, checking, sessionId, arrangement, finishRound]);

  const handleRevealSolution = useCallback(async () => {
    if (!roundId || solved) return;
    setError(null);
    try {
      const res = await revealRound(sessionId, roundId);
      finishRound(res.outcome, res.solution ?? null);
      if (res.solution && "pairs" in res.solution) {
        setPlaced(res.solution.pairs);
      } else if (res.solution && "assignment" in res.solution) {
        setPlaced(res.solution.assignment);
      }
    } catch {
      setError("Řešení se nepodařilo zobrazit.");
    }
  }, [roundId, solved, sessionId, finishRound]);

  if (!isInteractive) return INACTIVE_API;
  return {
    active: true,
    placed,
    pending,
    wrong,
    arrangement,
    mask,
    checking,
    solved,
    celebration,
    solution,
    error,
    handleDrop: orderAwareDrop,
    clearWrong,
    handleCheck,
    handleRevealSolution,
  };
}

// ---------------------------------------------------------------------------
// Rendering

interface BoardStyleProps {
  ageMode: LiveAgeMode;
  dark: boolean;
}

function cardShell(
  index: number,
  { ageMode, dark }: BoardStyleProps,
  state: CardState,
): string {
  const young = ageMode === "young";
  const senior = ageMode === "senior";
  return cn(
    "flex items-center justify-center gap-3 rounded-2xl border-4 px-5 text-center font-extrabold",
    young && cn(CARD_FILL[index % CARD_FILL.length], "border-transparent text-white text-[clamp(1.5rem,2.8vw,2.4rem)]"),
    !young && !senior && "border-line-strong bg-canvas text-ink text-[clamp(1.2rem,2.2vw,1.9rem)] shadow-tactile [--tactile-shadow:rgb(var(--line-strong))]",
    senior &&
      cn(
        "font-mono text-[clamp(1rem,1.8vw,1.5rem)]",
        dark
          ? "border-[rgb(var(--canvas))]/25 bg-[rgb(var(--canvas))]/5 text-[rgb(var(--canvas))]"
          : "border-line-strong bg-canvas text-ink",
      ),
    state === "settled" && "ring-4 ring-accent",
  );
}

function cardIcon(index: number, ageMode: LiveAgeMode): string | null {
  return ageMode === "young" ? (CARD_ICONS[index % CARD_ICONS.length] ?? null) : null;
}

/** Dispatcher plochy podle typu kola. */
export function InteractiveRoundBoard({
  round,
  api,
  ageMode,
  dark,
}: {
  round: LiveRound;
  api: InteractiveRoundApi;
  ageMode: LiveAgeMode;
  dark: boolean;
}): JSX.Element | null {
  const content = round.content;
  if (!content) return null;
  const style: BoardStyleProps = { ageMode, dark };

  return (
    <TouchDndBoard
      onDrop={api.handleDrop}
      disabled={api.solved}
      className="flex flex-1 flex-col"
    >
      {content.kind === "MATCH_PAIRS" ? (
        <MatchPairsBoard content={content} api={api} style={style} />
      ) : content.kind === "ORDER" ? (
        <OrderBoard content={content} api={api} style={style} />
      ) : (
        <SortBinsBoard content={content} api={api} style={style} />
      )}
      {api.celebration ? (
        <RoundCelebration outcome={api.celebration} ageMode={ageMode} />
      ) : null}
    </TouchDndBoard>
  );
}

function stateFor(
  api: InteractiveRoundApi,
  key: string,
): CardState {
  if (api.wrong[key]) return "wrong";
  if (api.pending[key]) return "pending";
  if (api.placed[key]) return "settled";
  return "idle";
}

/**
 * MATCH_PAIRS — levý sloupec pojmy (drop zóny se slotem), pravý sloupec
 * tažené kartičky. Přichycení = kartička zapadne do slotu vedle pojmu.
 */
function MatchPairsBoard({
  content,
  api,
  style,
}: {
  content: Extract<InteractiveBoardContent, { kind: "MATCH_PAIRS" }>;
  api: InteractiveRoundApi;
  style: BoardStyleProps;
}): JSX.Element {
  const rightById = useMemo(
    () => new Map(content.right.map((c) => [c.id, c])),
    [content.right],
  );
  // Pravé kartičky, které ještě nevisí v žádném slotu
  const attachedRight = new Set([
    ...Object.values(api.placed),
    ...Object.values(api.pending),
    ...Object.values(api.wrong),
  ]);
  const freeRight = content.right.filter((c) => !attachedRight.has(c.id));

  return (
    <div
      data-testid="live-match-board"
      className="grid flex-1 grid-cols-[1fr_minmax(0,0.9fr)] items-start gap-[3vw] py-[2vh]"
    >
      <div className="flex flex-col gap-[2vh]">
        {content.left.map((leftCard, i) => {
          const state = stateFor(api, leftCard.id);
          const attachedId =
            api.placed[leftCard.id] ??
            api.pending[leftCard.id] ??
            api.wrong[leftCard.id];
          const attached = attachedId ? rightById.get(attachedId) : undefined;
          return (
            <DropZone
              key={leftCard.id}
              targetId={leftCard.id}
              testId={`live-match-zone-${leftCard.id}`}
              className="grid grid-cols-2 items-stretch gap-3 rounded-2xl"
            >
              <div className={cardShell(i, style, "idle")} style={{ minHeight: 100 }}>
                {cardIcon(i, style.ageMode) ? (
                  <span aria-hidden>{cardIcon(i, style.ageMode)}</span>
                ) : null}
                {leftCard.text}
              </div>
              {/* Slot na dvojici: prázdný čekající rámeček / usazená kartička */}
              {attached ? (
                <DragCard
                  itemId={attached.id}
                  state={state}
                  onWrongAnimationEnd={() => api.clearWrong(leftCard.id)}
                  testId={`live-match-slot-${leftCard.id}`}
                  className={cn(cardShell(i, style, state))}
                >
                  {attached.text}
                  {state === "settled" ? <span aria-hidden> ✓</span> : null}
                </DragCard>
              ) : (
                <div
                  data-testid={`live-match-slot-${leftCard.id}`}
                  className={cn(
                    "flex items-center justify-center rounded-2xl border-4 border-dashed",
                    style.dark
                      ? "border-[rgb(var(--canvas))]/20 text-[rgb(var(--canvas))]/30"
                      : "border-line text-ink-dim/40",
                  )}
                  style={{ minHeight: 100 }}
                >
                  ?
                </div>
              )}
            </DropZone>
          );
        })}
      </div>
      <div className="flex flex-col gap-[2vh]">
        {freeRight.map((rightCard) => {
          const i = content.right.findIndex((c) => c.id === rightCard.id);
          return (
            <DragCard
              key={rightCard.id}
              itemId={rightCard.id}
              state="idle"
              testId={`live-match-card-${rightCard.id}`}
              className={cardShell(i, style, "idle")}
            >
              {rightCard.text}
            </DragCard>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ORDER — vodorovná řada, prohazování tahem, Zkontrolovat sedí v ovládacím
 * pruhu. Po kontrole se špatné kartičky zatřesou; správné dostanou fajfku.
 */
function OrderBoard({
  content,
  api,
  style,
}: {
  content: Extract<InteractiveBoardContent, { kind: "ORDER" }>;
  api: InteractiveRoundApi;
  style: BoardStyleProps;
}): JSX.Element {
  const byId = useMemo(
    () => new Map(content.items.map((c) => [c.id, c])),
    [content.items],
  );
  const labelClass = cn(
    "text-[clamp(1rem,1.8vw,1.5rem)] font-bold",
    style.dark ? "text-[rgb(var(--canvas))]/60" : "text-ink-muted",
  );

  return (
    <div
      data-testid="live-order-board"
      className="flex flex-1 flex-col items-center justify-center gap-[3vh]"
    >
      <div className="flex w-full items-center gap-[1.5vw]">
        {content.labels?.start ? (
          <span className={labelClass}>{content.labels.start} →</span>
        ) : null}
        <div className="grid flex-1 auto-cols-fr grid-flow-col gap-[1.5vw]">
          {api.arrangement.map((cardId, position) => {
            const card = byId.get(cardId) as BoardCard;
            const correctHere =
              api.solved || (api.mask ? api.mask[position] === true : false);
            const state: CardState = api.wrong[cardId]
              ? "wrong"
              : api.checking
                ? "pending"
                : correctHere
                  ? "settled"
                  : "idle";
            return (
              <DropZone
                key={cardId}
                targetId={cardId}
                testId={`live-order-zone-${cardId}`}
                className="rounded-2xl"
              >
                <DragCard
                  itemId={cardId}
                  state={api.solved ? "settled" : state}
                  onWrongAnimationEnd={() => api.clearWrong(cardId)}
                  testId={`live-order-card-${cardId}`}
                  className={cn(
                    cardShell(position, style, state),
                    "w-full py-[3vh]",
                  )}
                >
                  {card.text}
                  {correctHere ? <span aria-hidden> ✓</span> : null}
                </DragCard>
              </DropZone>
            );
          })}
        </div>
        {content.labels?.end ? (
          <span className={labelClass}>→ {content.labels.end}</span>
        ) : null}
      </div>
      {api.mask && !api.solved ? (
        <p className={labelClass} data-testid="live-order-hint">
          Zelené sedí — zkuste přeskládat zbytek a zkontrolovat znovu.
        </p>
      ) : null}
    </div>
  );
}

/**
 * SORT_BINS — 2–3 velké koše nahoře, zásobník kartiček dole. Usazené
 * kartičky zůstávají v koši jako menší štítky.
 */
function SortBinsBoard({
  content,
  api,
  style,
}: {
  content: Extract<InteractiveBoardContent, { kind: "SORT_BINS" }>;
  api: InteractiveRoundApi;
  style: BoardStyleProps;
}): JSX.Element {
  const usedCards = new Set([
    ...Object.keys(api.placed),
    ...Object.keys(api.pending),
    ...Object.keys(api.wrong),
  ]);
  const poolCards = content.cards.filter((c) => !usedCards.has(c.id));
  const cardIndex = useMemo(
    () => new Map(content.cards.map((c, i) => [c.id, i] as const)),
    [content.cards],
  );

  const binContents = (binId: string) =>
    content.cards.filter(
      (c) =>
        api.placed[c.id] === binId ||
        api.pending[c.id] === binId ||
        api.wrong[c.id] === binId,
    );

  return (
    <div
      data-testid="live-sort-board"
      className="flex flex-1 flex-col gap-[3vh] py-[2vh]"
    >
      <div
        className={cn(
          "grid flex-1 gap-[2vw]",
          content.bins.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {content.bins.map((bin, i) => (
          <DropZone
            key={bin.id}
            targetId={bin.id}
            testId={`live-sort-bin-${bin.id}`}
            className={cn(
              "flex min-h-[30vh] flex-col gap-3 rounded-3xl border-4 p-4",
              style.dark
                ? "border-[rgb(var(--canvas))]/25 bg-[rgb(var(--canvas))]/5"
                : "border-line-strong bg-canvas-alt",
            )}
          >
            <span
              className={cn(
                "text-center font-extrabold",
                style.ageMode === "young"
                  ? "text-[clamp(1.5rem,2.8vw,2.4rem)]"
                  : style.ageMode === "senior"
                    ? "font-mono text-[clamp(1.1rem,2vw,1.6rem)]"
                    : "text-[clamp(1.25rem,2.4vw,2rem)]",
                style.dark ? "text-[rgb(var(--canvas))]" : "text-ink",
              )}
            >
              {cardIcon(i, style.ageMode) ? (
                <span aria-hidden>{cardIcon(i, style.ageMode)} </span>
              ) : null}
              {bin.label}
            </span>
            <div className="flex flex-wrap content-start gap-2">
              {binContents(bin.id).map((card) => {
                const state = stateFor(api, card.id);
                return (
                  <DragCard
                    key={card.id}
                    itemId={card.id}
                    state={state}
                    onWrongAnimationEnd={() => api.clearWrong(card.id)}
                    testId={`live-sort-placed-${card.id}`}
                    className={cn(
                      cardShell(cardIndex.get(card.id) ?? 0, style, state),
                      "px-4 py-2 text-[clamp(1rem,1.6vw,1.4rem)]",
                    )}
                  >
                    {card.text}
                    {state === "settled" ? <span aria-hidden> ✓</span> : null}
                  </DragCard>
                );
              })}
            </div>
          </DropZone>
        ))}
      </div>
      <div
        data-testid="live-sort-pool"
        className="flex min-h-[14vh] flex-wrap items-center justify-center gap-[1.5vw]"
      >
        {poolCards.map((card) => (
          <DragCard
            key={card.id}
            itemId={card.id}
            state="idle"
            testId={`live-sort-card-${card.id}`}
            className={cn(
              cardShell(cardIndex.get(card.id) ?? 0, style, "idle"),
              "px-6 py-[2vh]",
            )}
          >
            {card.text}
          </DragCard>
        ))}
      </div>
    </div>
  );
}

/**
 * Oslava dokončeného kola — konfety (young/middle) / clean flash (senior).
 * Krátká a neblokující; auto-zmizí, ovládací pruh zůstává dostupný.
 */
function RoundCelebration({
  outcome,
  ageMode,
}: {
  outcome: LiveRoundOutcome;
  ageMode: LiveAgeMode;
}): JSX.Element {
  const senior = ageMode === "senior";
  const young = ageMode === "young";
  const pieces = useMemo(
    () =>
      Array.from({ length: senior ? 0 : young ? 36 : 20 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 8) * 0.12}s`,
        fill: CARD_FILL[i % CARD_FILL.length] as string,
      })),
    [senior, young],
  );

  return (
    <div
      data-testid="live-round-celebration"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {senior ? (
        <div className="absolute inset-0 animate-board-flash bg-accent" />
      ) : (
        pieces.map((p, i) => (
          <span
            key={i}
            className={cn(
              "absolute top-0 h-4 w-3 animate-confetti-fall rounded-sm",
              p.fill,
            )}
            style={{ left: p.left, animationDelay: p.delay }}
          />
        ))
      )}
      <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-3">
        {young ? <PartakBlob size={120} mood="happy" /> : null}
        <span
          className={cn(
            "animate-pop rounded-3xl px-8 py-4 font-extrabold",
            senior
              ? "border-2 border-accent font-mono text-3xl text-accent"
              : "bg-canvas text-[clamp(2rem,4vw,3.5rem)] text-ink shadow-soft",
          )}
        >
          {senior
            ? "Vyřešeno"
            : outcome === "MOSTLY_CORRECT"
              ? "Skvěle! 🎉"
              : "Zvládnuto! 💪"}
        </span>
      </div>
    </div>
  );
}
