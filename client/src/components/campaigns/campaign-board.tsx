"use client";

import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  getCampaignProgress,
  type CampaignProgressDetail,
} from "@/lib/api/campaigns";
import { ExpeditionMap } from "./expedition-map";
import { StickerCollection } from "./sticker-collection";
import { MissionBoard } from "./mission-board";

/**
 * Kampaňová projekce mimo bleskovku — rekapitulace kdykoli:
 *  - Výprava: mapa + třídní sbírka samolepek,
 *  - Mise: nástěnka fragmentů (tmavá scéna, viz MissionBoard).
 * Žádné srovnávání tříd — obrazovka zná jen JEDNU třídu (progressId).
 */
export function CampaignBoard({
  progressId,
}: {
  progressId: string;
}): JSX.Element {
  const router = useRouter();
  const [detail, setDetail] = useState<CampaignProgressDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getCampaignProgress(progressId)
      .then(setDetail)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Kampaň se nepodařilo načíst.",
        ),
      );
  }, [progressId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorAlert title="Kampaň" description={error} />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (detail.campaignType === "MISSION") {
    return <MissionBoard detail={detail} onChanged={reload} />;
  }

  const completed = detail.status === "COMPLETED";

  return (
    <div
      data-testid="campaign-board"
      data-campaign-type="EXPEDITION"
      className="flex min-h-screen flex-col items-center gap-[2.5vh] bg-canvas-alt px-[4vw] py-8 text-ink"
    >
      <header className="text-center">
        <p className="text-lg font-bold text-ink-muted">
          {detail.campaign?.subtitle ?? "Výprava"}
        </p>
        <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold">
          {detail.campaign?.title ?? detail.campaignId}
        </h1>
        <p
          data-testid="campaign-position"
          className="mt-1 text-xl font-bold text-accent-deep"
        >
          {completed
            ? "Výprava dokončena! 🎉"
            : `Zastávka ${detail.position} z ${detail.totalSteps}`}
        </p>
      </header>

      <div className="w-full max-w-6xl">
        <ExpeditionMap
          totalSteps={detail.totalSteps}
          position={detail.position}
          unlockedSteps={detail.unlockedSteps}
          nextStep={detail.nextStep}
        />
      </div>

      <section className="w-full max-w-4xl rounded-3xl border border-line bg-canvas p-6 shadow-soft">
        <h2 className="mb-4 text-center text-2xl font-extrabold">
          Třídní sbírka samolepek
        </h2>
        <StickerCollection
          unlockedSteps={detail.unlockedSteps}
          totalSteps={detail.totalSteps}
        />
      </section>

      <button
        type="button"
        data-testid="campaign-board-exit"
        onClick={() => router.push("/app")}
        className="mt-2 rounded-2xl bg-accent px-8 py-3 font-bold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed"
      >
        Zpět na přehled
      </button>
    </div>
  );
}
