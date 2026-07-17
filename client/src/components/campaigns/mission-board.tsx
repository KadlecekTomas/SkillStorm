"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { CampaignProgressDetail } from "@/lib/api/campaigns";

/**
 * Nástěnka Mise — tmavé plátno (senior tón), fragmenty záhady.
 * Scaffold — plná verze (terminál/archiv motiv, signál, epilogue,
 * vzkaz minulé třídy s reveal pojistkou) v BLOKU 4.
 */
export function MissionBoard({
  detail,
  onChanged,
}: {
  detail: CampaignProgressDetail;
  onChanged: () => void;
}): JSX.Element {
  const router = useRouter();
  void onChanged;
  return (
    <div
      data-testid="campaign-board"
      data-campaign-type="MISSION"
      className="flex min-h-screen flex-col items-center gap-6 bg-[rgb(var(--ink))] px-[4vw] py-10 text-[rgb(var(--canvas))]"
    >
      <h1 className="text-4xl font-extrabold">
        {detail.campaign?.title ?? detail.campaignId}
      </h1>
      <p className="text-lg opacity-70">
        Kapitola {detail.position} z {detail.totalSteps}
      </p>
      <button
        type="button"
        data-testid="campaign-board-exit"
        onClick={() => router.push("/app")}
        className="rounded-2xl bg-accent px-8 py-3 font-bold text-white"
      >
        Zpět na přehled
      </button>
    </div>
  );
}
