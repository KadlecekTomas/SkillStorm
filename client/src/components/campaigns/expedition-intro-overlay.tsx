"use client";

import type { JSX } from "react";
import { ExpeditionMap } from "./expedition-map";
import type { CampaignProgressDetail } from "@/lib/api/campaigns";

/**
 * Před bleskovkou: mapa ukáže, kde parťák stojí a kam dnes jde.
 * Overlay zavírá učitel tlačítkem „Vyrazit!" — pak začnou kola.
 */
export function ExpeditionIntroOverlay({
  detail,
  onStart,
}: {
  detail: CampaignProgressDetail;
  onStart: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="expedition-intro"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-[2vh] bg-canvas-alt px-[5vw] py-8"
    >
      <p className="text-xl font-bold text-ink-muted">
        {detail.campaign?.title ?? "Výprava"}
      </p>
      <h1 className="text-center text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold text-ink">
        {detail.nextStep
          ? `Dnes jdeme: ${detail.nextStep.title}`
          : "Výprava je u cíle!"}
      </h1>
      <div className="w-full max-w-5xl">
        <ExpeditionMap
          totalSteps={detail.totalSteps}
          position={detail.position}
          unlockedSteps={detail.unlockedSteps}
          nextStep={detail.nextStep}
        />
      </div>
      <button
        type="button"
        data-testid="expedition-intro-start"
        onClick={onStart}
        className="rounded-2xl bg-accent px-12 py-4 text-2xl font-extrabold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed"
      >
        Vyrazit! 🎒
      </button>
    </div>
  );
}
