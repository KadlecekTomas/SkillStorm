'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Radio, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { classroomSessionApi } from '@/lib/classroom-session-api';

export function AlgorithmLabQuickStart(): JSX.Element {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepareClassroom(): Promise<void> {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const session = await classroomSessionApi.quickStartAlgorithmLab();
      router.replace(`/app/labs/algorithm-lab/mission-control?session=${session.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hodinu se nepodařilo připravit.');
      setStarting(false);
    }
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#07101f] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-3xl rounded-[36px] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-400/15 text-violet-200">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/60">
              Algorithm Lab · rychlé spuštění
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Jedno tlačítko. Jedna společná hodina.
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          Klikni na Připravit hodinu. Pak pošli celé třídě jeden odkaz. SkillStorm žáky sám rozdělí do dvojic
          a ty už jen sleduješ průběh a spustíš hodinu, až budou připraveni.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <UsersRound className="h-5 w-5 text-cyan-200" aria-hidden="true" />
            <p className="mt-3 text-sm font-black">Dvojice automaticky</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Žádné vytváření skupin. Žáci se spojí po dvou sami.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <Radio className="h-5 w-5 text-violet-200" aria-hidden="true" />
            <p className="mt-3 text-sm font-black">Vše na jednom místě</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Vidíš připojení, dvojice, průběh i místa, kde je potřeba pomoct.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <ShieldCheck className="h-5 w-5 text-emerald-200" aria-hidden="true" />
            <p className="mt-3 text-sm font-black">Soukromí zachováno</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Bez sledování obrazovek, kurzoru a veřejného pořadí žáků.</p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="algorithm-quick-start-error">
            {error}
          </div>
        )}

        <button
          type="button"
          data-testid="algorithm-quick-start"
          disabled={starting}
          onClick={() => void prepareClassroom()}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-300 to-cyan-300 px-6 py-4 text-base font-black text-slate-950 shadow-[0_18px_60px_rgba(103,232,249,.18)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-wait disabled:opacity-60 sm:text-lg"
        >
          {starting ? 'Připravuji hodinu…' : 'Připravit hodinu'}
          {!starting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </button>

        <p className="mt-3 text-center text-[11px] leading-5 text-slate-600">
          Nic se nespustí samo. Start hodiny potvrdíš až na další obrazovce.
        </p>
      </section>
    </main>
  );
}
