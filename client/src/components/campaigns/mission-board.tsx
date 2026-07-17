"use client";

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import {
  previewPredecessorMessage,
  revealPredecessorMessage,
  submitCampaignEpilogue,
  type CampaignProgressDetail,
  type PredecessorMessage,
} from "@/lib/api/campaigns";
import { cn } from "@/utils/cn";

/**
 * Nástěnka Mise — tmavé plátno (senior tón), terminál/archiv motiv,
 * IBM Plex Mono akcenty. Učitel ji může promítnout kdykoli (rekapitulace
 * před další kapitolou). Skládá odemčené FRAGMENTY záhady; zamčené
 * kapitoly jsou jen šum.
 *
 * Vzkaz minulé třídy (reveal pojistka, decisions R6): dokud učitel
 * explicitně nepotvrdí, detail vzkaz vůbec neobsahuje — náhled je zvlášť
 * označený „jen pro učitele" a NIC nepromítá.
 */
export function MissionBoard({
  detail,
  onChanged,
}: {
  detail: CampaignProgressDetail;
  onChanged: () => void;
}): JSX.Element {
  const router = useRouter();
  const completed = detail.status === "COMPLETED";
  const unlockedByIndex = new Map(
    detail.unlockedSteps.map((u) => [u.stepIndex, u] as const),
  );
  const lastUnlocked = detail.unlockedSteps.at(-1);

  return (
    <div
      data-testid="campaign-board"
      data-campaign-type="MISSION"
      className="flex min-h-screen flex-col items-center gap-8 bg-[rgb(var(--ink))] px-[4vw] py-10 font-mono text-[rgb(var(--canvas))]"
    >
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
          ▚ archivní záznam · přístup povolen
        </p>
        <h1 className="mt-2 text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold tracking-tight">
          {detail.campaign?.title ?? detail.campaignId}
        </h1>
        {detail.campaign?.subtitle ? (
          <p className="mt-1 text-base text-[rgb(var(--canvas))]/60">
            {detail.campaign.subtitle}
          </p>
        ) : null}
        <p
          data-testid="campaign-position"
          className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-[rgb(var(--canvas))]/80"
        >
          {completed
            ? "všechny fragmenty dešifrovány"
            : `kapitola ${detail.position} / ${detail.totalSteps}`}
        </p>
      </header>

      {/* Fragmenty záhady */}
      <section className="grid w-full max-w-5xl gap-4 md:grid-cols-3">
        {Array.from({ length: detail.totalSteps }, (_, i) => {
          const stepIndex = i + 1;
          const unlocked = unlockedByIndex.get(stepIndex);
          const fragment = unlocked?.content?.fragment;
          if (unlocked && fragment) {
            return (
              <article
                key={stepIndex}
                data-testid={`fragment-${stepIndex}`}
                data-state="unlocked"
                className="flex flex-col rounded-2xl border border-accent/40 bg-[rgb(var(--canvas))]/5 p-5 shadow-[0_0_24px_rgb(var(--accent)/0.12)]"
              >
                <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-accent">
                  ● fragment {stepIndex} — {fragment.title}
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[rgb(var(--canvas))]/90">
                  {fragment.body}
                </p>
              </article>
            );
          }
          return (
            <article
              key={stepIndex}
              data-testid={`fragment-${stepIndex}`}
              data-state="locked"
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgb(var(--canvas))]/20 bg-[rgb(var(--canvas))]/[0.03] p-5 text-[rgb(var(--canvas))]/35"
            >
              <span className="text-lg tracking-[0.2em]" aria-hidden>
                ▒▒▒▒▒▒▒▒
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.3em]">
                zašifrováno
              </span>
            </article>
          );
        })}
      </section>

      {/* Cliffhanger poslední odemčené kapitoly — rekapitulace před další */}
      {lastUnlocked?.content?.cliffhanger ? (
        <p
          data-testid="mission-board-cliffhanger"
          className="max-w-3xl text-center text-lg font-bold italic text-[rgb(var(--canvas))]/90"
        >
          {lastUnlocked.content.cliffhanger}
        </p>
      ) : null}

      {/* Vzkaz minulé třídy — na plátno smí až po explicitním revealu */}
      <PredecessorMessagePanel detail={detail} onChanged={onChanged} />

      {/* Epilog: vzkaz budoucí třídě (jen po dokončení) */}
      {completed && detail.campaign?.epiloguePrompt ? (
        <EpiloguePanel detail={detail} onChanged={onChanged} />
      ) : null}

      <button
        type="button"
        data-testid="campaign-board-exit"
        onClick={() => router.push("/app")}
        className="mt-2 rounded-2xl border border-[rgb(var(--canvas))]/25 px-8 py-3 font-bold text-[rgb(var(--canvas))]/80 transition-colors hover:border-accent hover:text-accent"
      >
        ← zpět na přehled
      </button>
    </div>
  );
}

function PredecessorMessagePanel({
  detail,
  onChanged,
}: {
  detail: CampaignProgressDetail;
  onChanged: () => void;
}): JSX.Element | null {
  const [preview, setPreview] = useState<PredecessorMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!detail.predecessorMessageAvailable) return null;

  // Už odhaleno → vzkaz je součástí detailu a smí na projekci.
  if (detail.predecessorMessage) {
    return (
      <section
        data-testid="predecessor-message-revealed"
        className="w-full max-w-3xl rounded-2xl border border-streak/50 bg-[rgb(var(--canvas))]/5 p-6"
      >
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-streak">
          ◈ záznam z minulosti — {detail.predecessorMessage.sourceClassLabel}
        </h2>
        <p className="whitespace-pre-line text-base leading-relaxed text-[rgb(var(--canvas))]/90">
          {detail.predecessorMessage.message}
        </p>
      </section>
    );
  }

  // Neodhaleno: decka na projekci vidí jen „zapečetěný záznam";
  // náhled + rozhodnutí je čistě učitelské.
  return (
    <section
      data-testid="predecessor-message-sealed"
      className="w-full max-w-3xl rounded-2xl border border-dashed border-[rgb(var(--canvas))]/25 p-6 text-center"
    >
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-[rgb(var(--canvas))]/60">
        ◈ archiv obsahuje zapečetěný záznam
      </p>
      {preview ? (
        <div className="mt-4 rounded-xl border border-[rgb(var(--canvas))]/20 bg-[rgb(var(--canvas))]/5 p-4 text-left">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-danger">
            náhled jen pro učitele — třída ho zatím nevidí
          </p>
          <p className="whitespace-pre-line text-sm text-[rgb(var(--canvas))]/85">
            {preview.message}
          </p>
          <p className="mt-2 text-xs text-[rgb(var(--canvas))]/50">
            — {preview.sourceClassLabel}
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!preview ? (
          <button
            type="button"
            data-testid="predecessor-preview-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              previewPredecessorMessage(detail.id)
                .then(setPreview)
                .catch((err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Náhled se nepodařilo načíst.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
            className="rounded-xl border border-[rgb(var(--canvas))]/30 px-5 py-2 text-sm font-bold text-[rgb(var(--canvas))]/80 hover:border-accent hover:text-accent"
          >
            Přečíst si vzkaz (jen učitel)
          </button>
        ) : (
          <button
            type="button"
            data-testid="predecessor-reveal-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              revealPredecessorMessage(detail.id)
                .then(() => onChanged())
                .catch((err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Odhalení se nepovedlo.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed"
          >
            Promítnout vzkaz třídě
          </button>
        )}
      </div>
    </section>
  );
}

function EpiloguePanel({
  detail,
  onChanged,
}: {
  detail: CampaignProgressDetail;
  onChanged: () => void;
}): JSX.Element {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (detail.epilogueMessage) {
    return (
      <section
        data-testid="epilogue-saved"
        className="w-full max-w-3xl rounded-2xl border border-accent/40 bg-[rgb(var(--canvas))]/5 p-6"
      >
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-accent">
          ⏺ váš záznam pro budoucí třídu — uložen v archivu
        </h2>
        <p className="whitespace-pre-line text-base leading-relaxed text-[rgb(var(--canvas))]/90">
          {detail.epilogueMessage}
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="epilogue-form"
      className="w-full max-w-3xl rounded-2xl border border-[rgb(var(--canvas))]/20 bg-[rgb(var(--canvas))]/5 p-6"
    >
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-accent">
        ⏺ archiv čeká na váš záznam
      </h2>
      <p className="mb-4 text-sm text-[rgb(var(--canvas))]/70">
        {detail.campaign?.epiloguePrompt}
      </p>
      <textarea
        data-testid="epilogue-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="Vzkaz třídě, která archiv najde po vás…"
        className="w-full rounded-xl border border-[rgb(var(--canvas))]/25 bg-transparent p-3 text-sm text-[rgb(var(--canvas))] placeholder:text-[rgb(var(--canvas))]/35 focus:border-accent focus:outline-none"
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[rgb(var(--canvas))]/40">
          {message.length}/500
        </span>
        <button
          type="button"
          data-testid="epilogue-submit"
          disabled={busy || message.trim().length === 0}
          onClick={() => {
            setBusy(true);
            setError(null);
            submitCampaignEpilogue(detail.id, message.trim())
              .then(() => onChanged())
              .catch((err) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : "Záznam se nepodařilo uložit.",
                ),
              )
              .finally(() => setBusy(false));
          }}
          className={cn(
            "rounded-xl bg-accent px-6 py-2 text-sm font-bold text-white shadow-tactile [--tactile-shadow:rgb(var(--accent-deep))] transition-all active:translate-y-[2px] active:shadow-tactile-pressed",
            (busy || message.trim().length === 0) && "opacity-50",
          )}
        >
          Nahrát do archivu
        </button>
      </div>
    </section>
  );
}
