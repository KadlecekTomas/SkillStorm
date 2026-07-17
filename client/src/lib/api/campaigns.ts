"use client";

import { httpClient } from "@/lib/http/client";

/**
 * Kampaně (Výprava/Mise) — meziherní vrstva nad bleskovkami.
 * Postup se odemyká POUZE za dokončené bleskovky s ≥1 odehraným kolem;
 * správnost nikdy nerozhoduje. Vzkaz minulé třídy přijde v detailu až po
 * explicitním revealu učitelem (do té doby `predecessorMessage: null`).
 */

export type CampaignType = "EXPEDITION" | "MISSION";
export type CampaignProgressStatus = "ACTIVE" | "COMPLETED";

export interface CampaignSticker {
  key: string;
  name: string;
  emoji: string;
}

export interface CampaignFragment {
  kind: "text" | "image";
  title: string;
  body: string;
}

/** Krok z obsahu — Výprava má sticker+hook, Mise fragment+cliffhanger. */
export interface CampaignStepContent {
  key: string;
  title: string;
  scene: string;
  hook?: string;
  sticker?: CampaignSticker;
  fragment?: CampaignFragment;
  cliffhanger?: string;
}

export interface CampaignListItem {
  id: string;
  type: CampaignType;
  title: string;
  subtitle: string | null;
  intro: string;
  reviewStatus: "draft" | "approved";
  totalSteps: number;
  progress: {
    id: string;
    campaignId: string;
    status: CampaignProgressStatus;
    position: number;
    totalSteps: number;
  } | null;
}

export interface CampaignProgressSummary {
  id: string;
  classSectionId: string;
  campaignId: string;
  campaignType: CampaignType;
  title: string;
  status: CampaignProgressStatus;
  position: number;
  totalSteps: number;
  unlockedCount: number;
  startedAt: string;
  completedAt: string | null;
  predecessorMessageAvailable: boolean;
  contentMissing: boolean;
}

export interface CampaignUnlockedStep {
  stepIndex: number;
  stepKey: string;
  roundsPlayed: number;
  unlockedAt: string;
  content: CampaignStepContent | null;
}

export interface PredecessorMessage {
  message: string;
  submittedAt: string | null;
  sourceClassLabel: string;
}

export interface CampaignProgressDetail {
  id: string;
  classSectionId: string;
  campaignId: string;
  campaignType: CampaignType;
  campaign: {
    title: string;
    subtitle: string | null;
    intro: string;
    reviewStatus: "draft" | "approved";
    epiloguePrompt: string | null;
  } | null;
  status: CampaignProgressStatus;
  position: number;
  totalSteps: number;
  startedAt: string;
  completedAt: string | null;
  epilogueMessage: string | null;
  epilogueSubmittedAt: string | null;
  unlockedSteps: CampaignUnlockedStep[];
  /** Silueta dalšího kroku — jen key/title, scéna se nespoileruje. */
  nextStep: { stepIndex: number; key: string; title: string } | null;
  predecessorMessageAvailable: boolean;
  predecessorMessageRevealedAt: string | null;
  predecessorMessage: PredecessorMessage | null;
}

/** Výsledek advance z finish bleskovky (null = postup se nekonal). */
export interface CampaignAdvance {
  progressId: string;
  stepIndex: number;
  stepKey: string;
  position: number;
  totalSteps: number;
  status: CampaignProgressStatus;
}

export const listCampaignsForClass = (
  classSectionId: string,
): Promise<CampaignListItem[]> =>
  httpClient.get(`/campaigns?classSectionId=${classSectionId}`);

export const listCampaignProgress = (
  classSectionId: string,
): Promise<CampaignProgressSummary[]> =>
  httpClient.get(`/campaigns/progress?classSectionId=${classSectionId}`);

export const startCampaign = (
  campaignId: string,
  classSectionId: string,
): Promise<CampaignProgressSummary> =>
  httpClient.post("/campaigns/progress", { campaignId, classSectionId });

export const getCampaignProgress = (
  progressId: string,
): Promise<CampaignProgressDetail> =>
  httpClient.get(`/campaigns/progress/${progressId}`);

export const submitCampaignEpilogue = (
  progressId: string,
  message: string,
): Promise<{ id: string }> =>
  httpClient.post(`/campaigns/progress/${progressId}/epilogue`, { message });

/** Učitelský náhled vzkazu minulé třídy — NEPROVÁDÍ reveal. */
export const previewPredecessorMessage = (
  progressId: string,
): Promise<PredecessorMessage & { revealedAt: string | null }> =>
  httpClient.get(`/campaigns/progress/${progressId}/predecessor-message`);

/** Explicitní potvrzení — od té chvíle smí projekce vzkaz zobrazit. */
export const revealPredecessorMessage = (
  progressId: string,
): Promise<{ progressId: string; revealed: boolean }> =>
  httpClient.post(`/campaigns/progress/${progressId}/predecessor-message/reveal`);
