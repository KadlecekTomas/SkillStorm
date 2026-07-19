"use client";

import { httpClient } from "@/lib/http/client";
import type { CampaignAdvance } from "@/lib/api/campaigns";

/** Serverové enumy (Prisma) — viz docs/live-sessions.md */
export type LiveSessionStatus = "DRAFT" | "RUNNING" | "FINISHED";
export type ServerLiveAgeMode = "YOUNG" | "MIDDLE" | "SENIOR";
export type LiveRoundOutcome = "MOSTLY_CORRECT" | "SPLIT" | "MOSTLY_WRONG";

export type RoundOptionKey = "A" | "B" | "C" | "D";

export interface LiveRoundOption {
  key: RoundOptionKey;
  text: string;
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
  options: LiveRoundOption[];
  outcome: LiveRoundOutcome | null;
  /** null = kolo bez hlasování (skip cesta). */
  voteCounts: RoundVoteCounts | null;
  votingStartedAt: string | null;
  revealedAt: string | null;
  completedAt: string | null;
  correctKey?: RoundOptionKey;
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

export const revealRound = (
  sessionId: string,
  roundId: string,
): Promise<{
  roundId: string;
  correctKey: RoundOptionKey;
  voteCounts: RoundVoteCounts | null;
  totalVotes: number;
  /** Předvyplněný soud z hlasů (≥2/3, ≤1/3, jinak SPLIT) — null bez hlasů. */
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
