"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import type {
  CampaignAdvance,
  CampaignProgressDetail,
} from "@/lib/api/campaigns";

/**
 * Konec kapitoly Mise: „záznam dešifrován" → FRAGMENT záhady →
 * cliffhanger → POKRAČOVÁNÍ PŘÍŠTĚ. Tmavé plátno, terminál/archiv motiv.
 * Fragment odemkla ODEHRANÁ kapitola — správnost kol o ničem nerozhodla.
 */
export function MissionFinishScene({
  detail,
  advance,
}: {
  detail: CampaignProgressDetail;
  advance: CampaignAdvance;
}): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 800);
    return () => clearTimeout(t);
  }, []);

  const chapter = detail.unlockedSteps.find(
    (u) => u.stepIndex === advance.stepIndex,
  );
  const content = chapter?.content ?? null;
  const missionComplete = advance.status === "COMPLETED";

  return (
    <div
      data-testid="mission-finish-scene"
      className="flex w-full max-w-3xl flex-col items-center gap-5 font-mono"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
        ▚ záznam dešifrován · fragment {advance.stepIndex}/{advance.totalSteps}
      </p>

      {content ? (
        <p className="text-center text-lg leading-relaxed text-[rgb(var(--canvas))]/70">
          {content.scene}
        </p>
      ) : null}

      {content?.fragment && revealed ? (
        <figure
          data-testid="mission-fragment"
          className="w-full animate-pop rounded-2xl border border-accent/40 bg-[rgb(var(--canvas))]/5 p-6 text-left shadow-[0_0_30px_rgb(var(--accent)/0.15)]"
        >
          <figcaption className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-accent">
            ● {content.fragment.title}
          </figcaption>
          <blockquote className="whitespace-pre-line text-base leading-relaxed text-[rgb(var(--canvas))]/90">
            {content.fragment.body}
          </blockquote>
        </figure>
      ) : null}

      {content?.cliffhanger && revealed ? (
        <p
          data-testid="mission-cliffhanger"
          className="text-center text-xl font-bold italic text-[rgb(var(--canvas))]"
        >
          {content.cliffhanger}
        </p>
      ) : null}

      {revealed ? (
        <p
          data-testid="mission-to-be-continued"
          className="mt-2 text-sm font-bold uppercase tracking-[0.35em] text-[rgb(var(--canvas))]/60"
        >
          {missionComplete ? "— konec záznamu —" : "pokračování příště"}
          <span className="ml-1 inline-block w-3 animate-pulse">▮</span>
        </p>
      ) : null}
    </div>
  );
}
