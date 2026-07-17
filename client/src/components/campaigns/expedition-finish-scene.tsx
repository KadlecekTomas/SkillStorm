"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { ExpeditionMap } from "./expedition-map";
import type {
  CampaignAdvance,
  CampaignProgressDetail,
} from "@/lib/api/campaigns";

/**
 * Scéna „nálezu" po dokončené kampaňové bleskovce (Výprava):
 * 1) parťák dorazil na zastávku (mapa s novou pozicí),
 * 2) scéna zastávky + samolepka do třídní sbírky (pop animace),
 * 3) HÁČEK: silueta další zastávky na mapě + jedna věta.
 * Postup vznikl za ODEHRANÁ kola — správnost sem nevstupuje.
 */
export function ExpeditionFinishScene({
  detail,
  advance,
}: {
  detail: CampaignProgressDetail;
  advance: CampaignAdvance;
}): JSX.Element {
  const [showSticker, setShowSticker] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSticker(true), 900);
    return () => clearTimeout(t);
  }, []);

  const reached = detail.unlockedSteps.find(
    (u) => u.stepIndex === advance.stepIndex,
  );
  const content = reached?.content ?? null;
  const finishedWholeCampaign = advance.status === "COMPLETED";

  return (
    <div
      data-testid="expedition-finish-scene"
      className="flex w-full max-w-5xl flex-col items-center gap-[2vh]"
    >
      <h2 className="text-[clamp(1.6rem,3.5vw,2.6rem)] font-extrabold text-ink">
        {content ? `Dorazili jsme: ${content.title}!` : "Zastávka dosažena!"}
      </h2>
      {content ? (
        <p className="max-w-3xl text-center text-[clamp(1.1rem,2vw,1.5rem)] font-semibold text-ink-muted">
          {content.scene}
        </p>
      ) : null}

      <ExpeditionMap
        totalSteps={detail.totalSteps}
        position={detail.position}
        unlockedSteps={detail.unlockedSteps}
        nextStep={detail.nextStep}
        className="max-h-[38vh]"
      />

      {content?.sticker && showSticker ? (
        <div
          data-testid="expedition-sticker-earned"
          className="flex animate-pop items-center gap-3 rounded-2xl border-2 border-accent bg-accent-soft px-6 py-3"
        >
          <span className="text-5xl" role="img" aria-label={content.sticker.name}>
            {content.sticker.emoji}
          </span>
          <div className="text-left">
            <p className="text-sm font-bold uppercase tracking-wide text-accent-deep">
              Samolepka do třídní sbírky
            </p>
            <p className="text-xl font-extrabold text-ink">
              {content.sticker.name}
            </p>
          </div>
        </div>
      ) : null}

      {/* Háček na příště — u dokončené výpravy závěrečná věta místo siluety */}
      {content?.hook ? (
        <p
          data-testid="expedition-hook"
          className="text-center text-[clamp(1.1rem,2.2vw,1.6rem)] font-bold italic text-accent-deep"
        >
          {finishedWholeCampaign ? "🏁 " : "✨ "}
          {content.hook}
        </p>
      ) : null}
    </div>
  );
}
