'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import {
  Activity,
  ArrowRight,
  CircleStop,
  MonitorUp,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  classroomSessionApi,
  type ClassroomCommandType,
  type TeacherClassroomSessionProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_750;

type BuildPcMissionControlProps = {
  sessionId: string | null;
};

function statusClasses(status: TeacherClassroomSessionProjection['status']): string {
  if (status === 'RUNNING') return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100';
  if (status === 'PAUSED') return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
  if (status === 'FINISHED') return 'border-slate-400/20 bg-white/[0.05] text-slate-300';
  return 'border-violet-300/30 bg-violet-400/10 text-violet-100';
}

export function BuildPcMissionControl({ sessionId }: BuildPcMissionControlProps): JSX.Element {
  const [session, setSession] = useState<TeacherClassroomSessionProjection | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [busy, setBusy] = useState<ClassroomCommandType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const next = await classroomSessionApi.teacherProjection(sessionId);
      setSession(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mission Control se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    if (!sessionId) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, sessionId]);

  const currentStageIndex = useMemo(() => {
    if (!session?.currentLessonStageId) return -1;
    return session.lesson.stages.findIndex((stage) => stage.id === session.currentLessonStageId);
  }, [session]);

  async function runCommand(type: ClassroomCommandType): Promise<void> {
    if (!sessionId || !session || busy) return;
    setBusy(type);
    try {
      const result = await classroomSessionApi.command(sessionId, type, session.stateRevision);
      setSession(result.session);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Příkaz se nepodařilo provést.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!sessionId) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#07101f] px-4 text-white">
        <div className="max-w-lg rounded-[30px] border border-white/10 bg-white/[0.04] p-8 text-center">
          <MonitorUp className="mx-auto h-10 w-10 text-violet-300" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black">Teacher Mission Control</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Otevři Mission Control s parametrem konkrétní classroom session.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#07101f] text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#07101f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/60">Interactive IT Lab · Teacher</p>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Mission Control · Build a PC</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session && (
              <span className={`rounded-full border px-3 py-2 text-xs font-black ${statusClasses(session.status)}`} data-testid="mission-status">
                {session.status}
              </span>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10"
              aria-label="Obnovit stav hodiny"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="mission-error">
            {error}
          </div>
        )}

        {session ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-black uppercase tracking-[0.16em]">Připojeno</span><Users className="h-4 w-4" /></div>
                <div className="mt-3 text-3xl font-black" data-testid="mission-connected">{session.participantSummary.connected}<span className="text-base text-slate-600">/{session.participantSummary.total}</span></div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-black uppercase tracking-[0.16em]">Odpojeno</span><WifiOff className="h-4 w-4" /></div>
                <div className="mt-3 text-3xl font-black">{session.participantSummary.disconnected}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-black uppercase tracking-[0.16em]">State revision</span><Activity className="h-4 w-4" /></div>
                <div className="mt-3 text-3xl font-black" data-testid="mission-revision">{session.stateRevision}</div>
              </div>
              <div className="rounded-[24px] border border-emerald-300/10 bg-emerald-400/[0.05] p-4">
                <div className="flex items-center justify-between text-emerald-200/50"><span className="text-[10px] font-black uppercase tracking-[0.16em]">Privacy</span><ShieldCheck className="h-4 w-4" /></div>
                <div className="mt-3 text-3xl font-black text-emerald-100">0</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/40">pointer streams</div>
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Lesson Experience v{session.lesson.versionNo}</p>
                    <h2 className="mt-1 text-xl font-black">{session.lesson.title}</h2>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">{session.mode}</span>
                </div>

                <div className="mt-5 space-y-2">
                  {session.lesson.stages.map((stage, index) => {
                    const active = stage.id === session.currentLessonStageId;
                    const completed = currentStageIndex >= 0 && index < currentStageIndex;
                    return (
                      <div key={stage.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${active ? 'border-violet-300/35 bg-violet-400/10' : completed ? 'border-emerald-300/15 bg-emerald-400/[0.05]' : 'border-white/5 bg-black/10'}`}>
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${active ? 'bg-violet-400/20 text-violet-100' : completed ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/[0.04] text-slate-600'}`}>{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-bold ${active ? 'text-white' : completed ? 'text-emerald-100' : 'text-slate-500'}`}>{stage.title}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{stage.stageType} · {stage.stageKey}</p>
                        </div>
                        {active && <Radio className="h-4 w-4 animate-pulse text-violet-300" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Zařízení ve třídě</p>
                    <h2 className="mt-1 text-xl font-black">Žáci</h2>
                  </div>
                  <Users className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                </div>

                <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {session.participants.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Zatím není připojené žádné žákovské zařízení.</div>
                  ) : session.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/15 px-3 py-3">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${participant.status === 'CONNECTED' ? 'bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.45)]' : 'bg-slate-600'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-200">{participant.nickname || 'Žák'}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{participant.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="sticky bottom-3 mt-4 rounded-[26px] border border-white/10 bg-[#0a1425]/92 p-3 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {session.status === 'DRAFT' && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void runCommand('START')} className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-emerald-950 disabled:opacity-50" data-testid="mission-start"><Play className="h-4 w-4" /> Spustit</button>
                  )}
                  {session.status === 'RUNNING' && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void runCommand('PAUSE')} className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-black text-amber-100 disabled:opacity-50" data-testid="mission-pause"><Pause className="h-4 w-4" /> Pozastavit</button>
                  )}
                  {session.status === 'PAUSED' && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void runCommand('RESUME')} className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-emerald-950 disabled:opacity-50" data-testid="mission-resume"><Play className="h-4 w-4" /> Pokračovat</button>
                  )}
                  {session.status === 'RUNNING' && currentStageIndex >= 0 && currentStageIndex < session.lesson.stages.length - 1 && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void runCommand('NEXT_STAGE')} className="flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-3 text-xs font-black text-violet-100 disabled:opacity-50" data-testid="mission-next"><SkipForward className="h-4 w-4" /> Další stage</button>
                  )}
                  {(session.status === 'RUNNING' || session.status === 'PAUSED') && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void runCommand('FINISH')} className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-xs font-black text-rose-100 disabled:opacity-50" data-testid="mission-finish"><CircleStop className="h-4 w-4" /> Ukončit</button>
                  )}
                </div>

                <Link href="/app/labs/build-a-pc" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-slate-200 transition hover:bg-white/10">
                  Solo náhled hry <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </>
        ) : (
          <div className="grid min-h-[65vh] place-items-center">
            <div className="text-center text-slate-400">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-violet-300" aria-hidden="true" />
              <p className="mt-3 text-sm">Načítám classroom session…</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
