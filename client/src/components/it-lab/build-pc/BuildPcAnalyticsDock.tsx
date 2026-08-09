'use client';

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Radio, RefreshCw, Users } from 'lucide-react';
import {
  classroomSessionApi,
  type BuildPcAnalyticsProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_750;

type BuildPcAnalyticsDockProps = {
  sessionId: string | null;
};

export function BuildPcAnalyticsDock({ sessionId }: BuildPcAnalyticsDockProps): JSX.Element | null {
  const [analytics, setAnalytics] = useState<BuildPcAnalyticsProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      setAnalytics(await classroomSessionApi.buildPcAnalytics(sessionId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analytiku se nepodařilo načíst.');
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    if (!sessionId) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, sessionId]);

  const attentionParticipants = useMemo(
    () => analytics?.participants.filter((participant) => participant.needsAttention).slice(0, 5) ?? [],
    [analytics],
  );

  if (!sessionId) return null;

  return (
    <aside
      className="fixed bottom-24 left-4 z-[65] w-[min(430px,calc(100vw-32px))] rounded-[26px] border border-white/10 bg-[#0a1425]/95 p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,.6)] backdrop-blur-xl lg:bottom-4"
      data-testid="mission-analytics-dock"
      aria-label="Živá analytika Build a PC"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/60">Intervention radar</p>
          <h2 className="mt-1 text-base font-black">Co právě potřebuje učitel vědět</h2>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Obnovit analytiku"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error && !analytics ? (
        <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : analytics ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-2">
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500"><Radio className="h-3 w-3" /> postup</div>
              <div className="mt-1 text-xl font-black" data-testid="mission-class-progress">{analytics.classSummary.averageProgressPct}%</div>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2">
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200/50"><AlertTriangle className="h-3 w-3" /> pomoc</div>
              <div className="mt-1 text-xl font-black text-amber-100" data-testid="mission-needs-attention">{analytics.classSummary.needsAttention}</div>
            </div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-2">
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200/50"><CheckCircle2 className="h-3 w-3" /> hotovo</div>
              <div className="mt-1 text-xl font-black text-emerald-100">{analytics.classSummary.completed}</div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200/60">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Největší společný problém
            </div>
            {analytics.topMisconception ? (
              <div className="mt-2" data-testid="mission-top-misconception">
                <p className="text-sm font-black text-violet-50">{analytics.topMisconception.label}</p>
                <p className="mt-1 text-xs text-violet-100/60">
                  {analytics.topMisconception.participantCount} žáků · {analytics.topMisconception.count} odmítnutých pokusů
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-400">Zatím nevznikl opakující se misconception cluster.</p>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Priorita zásahu</span>
              <span>{analytics.classSummary.totalHints} hints · {analytics.classSummary.totalRejectedPlacements} chyb</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {attentionParticipants.length === 0 ? (
                <div className="rounded-xl border border-emerald-300/10 bg-emerald-400/[0.04] px-3 py-2 text-xs text-emerald-100/70">
                  Nikdo zatím nepřekročil práh pro zásah.
                </div>
              ) : (
                attentionParticipants.map((participant) => (
                  <div key={participant.participantId} className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/15 px-3 py-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${participant.stalled ? 'bg-rose-300' : 'bg-amber-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-100">{participant.nickname}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {participant.progressPct}% · {participant.rejectedPlacements} chyb · {participant.hintCount} hints{participant.stalled ? ' · stojí' : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Načítám živou analytiku…
        </div>
      )}
    </aside>
  );
}
