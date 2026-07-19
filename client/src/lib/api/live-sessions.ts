"use client";

import { httpClient } from "@/lib/http/client";
import type { CampaignAdvance } from "@/lib/api/campaigns";

/** Serverové enumy (Prisma) — viz docs/live-sessions.md */
export type LiveSessionStatus = "DRAFT" | "RUNNING" | "FINISHED";
export type ServerLiveAgeMode = "YOUNG" | "MIDDLE" | "SENIOR";
export type LiveRoundOutcome = "MOSTLY_CORRECT" | "SPLIT" | "MOSTLY_WRONG";

export type RoundOptionKey = "A" | "B" | "C" | "D";

export type RoundInteractionType =
  | "QUIZ"
  | "MATCH_PAIRS"
  | "ORDER"
  | "SORT_BINS";

export interface LiveRoundOption {
  key: RoundOptionKey;
  text: string;
}

export interface BoardCard {
  id: string;
  text: string;
}

/** Board-safe obsah interaktivního kola — zamíchané, BEZ řešení. */
export type InteractiveBoardContent =
  | { kind: "MATCH_PAIRS"; left: BoardCard[]; right: BoardCard[] }
  | {
      kind: "ORDER";
      items: BoardCard[];
      labels?: { start?: string; end?: string };
    }
  | {
      kind: "SORT_BINS";
      bins: Array<{ id: string; label: string }>;
      cards: BoardCard[];
    };

/** Řešení — server ho posílá až po dokončení/revealu kola. */
export type InteractiveSolution =
  | { pairs: Record<string, string> }
  | { order: string[] }
  | { assignment: Record<string, string> };

/**
 * Anonymní agregát průběhu interaktivního kola: počty pokusů + správně
 * usazené položky (obnova plochy po refreshi). Bez vazby na osoby.
 */
export interface RoundAttemptStats {
  wrong: number;
  placed: Record<string, string>;
  checks: number;
}

/** Anonymní agregáty hlasů z tabule — {"A": 14, "B": 6}, bez vazby na osoby. */
export type RoundVoteCounts = Partial<Record<RoundOptionKey, number>>;

/**
 * Kolo z projekčního API. `correctKey` je přítomen POUZE u odhalených kol —
 * server správný klíč před revealem nikdy neposílá (sdílené zařízení,
 * network tab nesmí prozradit odpovědi budoucích kol).
 */
export interface LiveRound {
  id: string;
  order: number;
  questionText: string;
  interactionType: RoundInteractionType;
  /** QUIZ only — u interaktivních kol prázdné pole. */
  options: LiveRoundOption[];
  /** Interaktivní kola — board-safe obsah; u QUIZ null. */
  content: InteractiveBoardContent | null;
  /** Interaktivní kola — agregát průběhu (obnova plochy po refreshi). */
  attemptStats: RoundAttemptStats | null;
  outcome: LiveRoundOutcome | null;
  /** null = kolo bez hlasování (skip cesta). */
  voteCounts: RoundVoteCounts | null;
  votingStartedAt: string | null;
  revealedAt: string | null;
  completedAt: string | null;
  correctKey?: RoundOptionKey;
  /** Jen po dokončení/revealu interaktivního kola. */
  solution?: InteractiveSolution;
}

export interface LiveSessionProjection {
  id: string;
  status: LiveSessionStatus;
  mode: "BOARD_ONLY" | "DEVICES";
  ageMode: ServerLiveAgeMode;
  countdownSec: number | null;
  classSectionId: string | null;
  campaignProgressId: string | null;
  testTitle: string;
  startedAt: string | null;
  finishedAt: string | null;
  rounds: LiveRound[];
}

export interface CreateLiveSessionInput {
  testId: string;
  classSectionId?: string;
  ageMode?: ServerLiveAgeMode;
  countdownSec?: number;
  /** Volitelná vazba na kampaň — vyžaduje classSectionId třídy kampaně. */
  campaignProgressId?: string;
}

export interface LiveSessionFinishResult {
  id: string;
  status: "FINISHED";
  playedRounds: number;
  outcomes: Array<{ outcome: LiveRoundOutcome | null; count: number }>;
  xpDelta: number;
  previousXp: number | null;
  partak: { xp: number; stage: number } | null;
  stageUp: boolean;
  /** Kampaňový postup — null, když session nebyla kampaňová nebo 0 kol. */
  campaignAdvance: CampaignAdvance | null;
}

export interface ClassPartakState {
  classSectionId: string;
  xp: number;
  stage: number;
}

export const createLiveSession = (
  input: CreateLiveSessionInput,
): Promise<{ id: string }> => httpClient.post("/live-sessions", input);

export const startLiveSession = (id: string): Promise<LiveSessionProjection> =>
  httpClient.post(`/live-sessions/${id}/start`);

export const getLiveSession = (id: string): Promise<LiveSessionProjection> =>
  httpClient.get(`/live-sessions/${id}`);

export const openRoundVoting = (
  sessionId: string,
  roundId: string,
): Promise<{
  roundId: string;
  votingStartedAt: string;
  voteCounts: RoundVoteCounts;
}> => httpClient.post(`/live-sessions/${sessionId}/rounds/${roundId}/voting`);

/** Jeden dotyk na tabuli: tap = +1, long-press = −1. Server klampuje na 0. */
export const castRoundVote = (
  sessionId: string,
  roundId: string,
  key: RoundOptionKey,
  delta: 1 | -1 = 1,
): Promise<{
  roundId: string;
  voteCounts: RoundVoteCounts;
  totalVotes: number;
}> =>
  httpClient.post(`/live-sessions/${sessionId}/rounds/${roundId}/votes`, {
    key,
    delta,
  });

export interface AttemptResult {
  roundId: string;
  interactionType: RoundInteractionType;
  wrong: number;
  checks: number;
  placed: Record<string, string>;
  placedCount: number;
  itemCount: number;
  solved: boolean;
  outcome: LiveRoundOutcome | null;
  /** PLACE: soud serveru pro tenhle tah. */
  correct?: boolean;
  /** CHECK (ORDER): správnost po pozicích. */
  mask?: boolean[];
  justCompleted?: boolean;
  alreadyCompleted?: boolean;
  /** Jen když je kolo dokončené. */
  solution?: InteractiveSolution;
}

/**
 * Jeden tah na tabuli — server soudí každé položení (řešení nikdy není na
 * klientu před dokončením). Volá se bez čekání na předchozí tah: každá
 * kartička má vlastní pending stav, děti u tabule nečekají.
 */
export const submitRoundAttempt = (
  sessionId: string,
  roundId: string,
  attempt:
    | { kind: "PLACE"; itemId: string; targetId: string }
    | { kind: "CHECK"; arrangement: string[] },
): Promise<AttemptResult> =>
  httpClient.post(
    `/live-sessions/${sessionId}/rounds/${roundId}/attempts`,
    attempt,
  );

/**
 * QUIZ: vrací correctKey (+ hlasy). Interaktivní kola: „Ukázat řešení" —
 * vrací solution + attemptStats (učitelská pojistka, když se třída zasekne).
 */
export const revealRound = (
  sessionId: string,
  roundId: string,
): Promise<{
  roundId: string;
  correctKey?: RoundOptionKey;
  voteCounts?: RoundVoteCounts | null;
  totalVotes?: number;
  interactionType?: RoundInteractionType;
  solution?: InteractiveSolution;
  attemptStats?: RoundAttemptStats;
  /** Předvyplněný soud z hlasů/pokusů — null bez aktivity. */
  autoOutcome: LiveRoundOutcome | null;
  outcome: LiveRoundOutcome | null;
}> => httpClient.post(`/live-sessions/${sessionId}/rounds/${roundId}/reveal`);

export const setRoundOutcome = (
  sessionId: string,
  roundId: string,
  outcome: LiveRoundOutcome,
): Promise<{ id: string; outcome: LiveRoundOutcome }> =>
  httpClient.post(`/live-sessions/${sessionId}/rounds/${roundId}/outcome`, {
    outcome,
  });

export const finishLiveSession = (
  id: string,
): Promise<LiveSessionFinishResult> =>
  httpClient.post(`/live-sessions/${id}/finish`);

export const getClassPartak = (
  classSectionId: string,
): Promise<ClassPartakState> =>
  httpClient.get(`/live-sessions/class-partak/${classSectionId}`);
