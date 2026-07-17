"use client";

import type { JSX } from "react";
import type { CampaignUnlockedStep } from "@/lib/api/campaigns";
import { cn } from "@/utils/cn";

/**
 * Třídní sbírka samolepek z Výpravy — viditelná učiteli i na projekci.
 * Sbírka je TŘÍDNÍ (odemčené zastávky kampaně), žádná individuální data.
 * Zamčené pozice jsou jen čárkované siluety s otazníkem.
 */
export function StickerCollection({
  unlockedSteps,
  totalSteps,
  size = "md",
  className,
}: {
  unlockedSteps: CampaignUnlockedStep[];
  totalSteps: number;
  size?: "md" | "lg";
  className?: string;
}): JSX.Element {
  const byIndex = new Map(unlockedSteps.map((u) => [u.stepIndex, u] as const));
  const lg = size === "lg";
  return (
    <div
      data-testid="sticker-collection"
      className={cn(
        "grid gap-3",
        lg ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-8",
        className,
      )}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepIndex = i + 1;
        const unlocked = byIndex.get(stepIndex);
        const sticker = unlocked?.content?.sticker;
        if (unlocked && sticker) {
          return (
            <div
              key={stepIndex}
              data-testid={`sticker-${stepIndex}`}
              data-state="unlocked"
              className="flex flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border-4 border-accent bg-canvas shadow-tactile-sm [--tactile-shadow:rgb(var(--accent-deep))] animate-pop",
                  lg ? "h-24 w-24 text-5xl" : "h-16 w-16 text-3xl",
                )}
                role="img"
                aria-label={sticker.name}
              >
                {sticker.emoji}
              </span>
              <span
                className={cn(
                  "text-center font-bold text-ink",
                  lg ? "text-sm" : "text-xs",
                )}
              >
                {sticker.name}
              </span>
            </div>
          );
        }
        return (
          <div
            key={stepIndex}
            data-testid={`sticker-${stepIndex}`}
            data-state="locked"
            className="flex flex-col items-center gap-1"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full border-4 border-dashed border-line-strong bg-canvas-alt text-ink-dim",
                lg ? "h-24 w-24 text-4xl" : "h-16 w-16 text-2xl",
              )}
              aria-hidden
            >
              ?
            </span>
            <span className={cn("text-ink-dim", lg ? "text-sm" : "text-xs")}>
              &nbsp;
            </span>
          </div>
        );
      })}
    </div>
  );
}
