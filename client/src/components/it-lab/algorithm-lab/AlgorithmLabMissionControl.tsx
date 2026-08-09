'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import {
  AlertTriangle,
  Atom,
  Bot,
  Braces,
  CircleStop,
  Gauge,
  HelpCircle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  classroomSessionApi,
  type AlgorithmLabAnalyticsProjection,
  type ClassroomCommandType,
  type TeacherClassroomSessionProjection,
} from '@/lib/classroom-session-api';

const POLL_MS = 1_500;

type Props = { sessionId: string | null };

type MilestoneKey = keyof AlgorithmLabAnalyticsProjection['groups'][number]['milestones'];

const milestoneLabel: Record<MilestoneKey, string> = {
  pairOnline: 'Dvojice online',
  handedOff: 'Předání role',
  programStarted: 'Program spuštěn',
  debugLoop: 'Debug loop',
  roleRotated: 'Role prohozeny',
  askedForHelp: 'Práce s nápovědou',
};

function phaseLabel(phase: AlgorithmLabAnalyticsProjection['groups'][number]['phase']): string {
  if (phase === 'PLAN') return 'Plánování';
  if (phase === 'PROGRAM') return 'Programování';
  return 'Čeká na dvojici';
}

function reactorCopy(level: AlgorithmLabAnalyticsProjection['reactor']['level']): string {
  if (level === 'NOVA') return 'Třída je v plném kooperačním flow.';
  if (level === 'ORBIT') return 'Většina dvojic už střídá role a iteruje.';
  if (level === 'PULSE') return 'Spolupráce se rozbíhá. Sleduj slabá místa.';
  return 'Reaktor čeká na první koordinované kroky.';
}

export function AlgorithmLabMissionControl({ sessionId }: Props): JSX.Element {
  const [analytics, setAnalytics] = useState<AlgorithmLabAnalyticsProjection | null>(null);
  const [session, setSession] = useState<TeacherClassroomSessionProjection | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [busy, setBusy] = useState<ClassroomCommandType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const [nextAnalytics, nextSession] = await Promise.all([
        classroomSessionApi.algorithmLabAnalytics(sessionId),
        classroomSessionApi.teacherProjection(sessionId),
      ]);
      setAnalytics(nextAnalytics);
      setSession(nextSession);
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

  async function runCommand(type: ClassroomCommandType): Promise<void> {
    if (!sessionId || !session || busy) return;
    setBusy(type);
    try {
      const result = await classroomSessionApi.command(sessionId, type, session.stateRevision);
      setSession(result.session);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Příkaz se nepodařilo provést.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!sessionId) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#050b16] px-4 text-white">
        <div className="max-w-xl rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <Bot className="mx-auto h-12 w-12 text-cyan-300" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-black">Algorithm Lab Mission Control</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Otevři dashboard s parametrem konkrétní classroom session. Žádný veřejný leaderboard, žádné sledování obrazovek.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#050b16] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#050b16]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/55">Interactive IT Lab · Teacher</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Mission Control · Algorithm Lab</h1>
            <p className="mt-1 text-xs text-slate-500">{analytics?.session.lessonTitle ?? 'Načítám hodinu…'}{analytics?.session.stageTitle ? ` · ${analytics.session.stageTitle}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-200" data-testid="algorithm-mission-status">
              {analytics?.session.status ?? 'LOADING'}
            </span>
            <button type="button" onClick={() => void refresh()} aria-label="Obnovit Mission Control" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {error && <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

        {analytics ? (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <div className="relative overflow-hidden rounded-[32px] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.035] to-violet-400/[0.06] p-5 shadow-2xl sm:p-6" data-testid="algorithm-reactor">
                <div className="absolute right-5 top-5 grid h-16 w-16 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_60px_rgba(34,211,238,.15)]">
                  <Atom className="h-8 w-8 text-cyan-200" aria-hidden="true" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Class Mission Reactor</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-5xl font-black tracking-tight" data-testid="algorithm-reactor-progress">{analytics.reactor.progressPct}%</span>
                  <span className="mb-1 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">{analytics.reactor.level}</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{reactorCopy(analytics.reactor.level)}</p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 transition-[width] duration-700" style={{ width: `${analytics.reactor.progressPct}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                  <span>{analytics.reactor.earnedEnergy}/{analytics.reactor.maxEnergy} cooperation signals</span>
                  <span>Další režim při {analytics.reactor.nextLevelAt}%</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(['BOOT', 'PULSE', 'ORBIT', 'NOVA'] as const).map((level) => {
                    const order = ['BOOT', 'PULSE', 'ORBIT', 'NOVA'];
                    const unlocked = order.indexOf(level) <= order.indexOf(analytics.reactor.level);
                    return <span key={level} className={`rounded-xl border px-3 py-2 text-xs font-black ${unlocked ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border-white/5 bg-black/10 text-slate-700'}`}>{unlocked ? '✦ ' : '○ '}{level}</span>;
                  })}
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-emerald-200/60"><ShieldCheck className="h-4 w-4" /> Reactor je pouze kooperativní feedback. Nemění mastery, známku ani XP.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                <Metric icon={<UsersRound className="h-4 w-4" />} label="Dvojice" value={analytics.summary.groups} />
                <Metric icon={<Wifi className="h-4 w-4" />} label="Obě zařízení online" value={`${analytics.summary.connectedPairs}/${analytics.summary.groups}`} />
                <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Potřebují zásah" value={analytics.summary.needsAttention} danger={analytics.summary.needsAttention > 0} />
                <Metric icon={<Gauge className="h-4 w-4" />} label="Program runs" value={analytics.summary.totalProgramRuns} />
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Live pair map</p>
                  <h2 className="mt-1 text-xl font-black">Dvojice ve třídě</h2>
                </div>
                <p className="text-xs text-slate-500">Priorita je intervention, ne pořadí.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="algorithm-pair-grid">
                {analytics.groups.map((group) => (
                  <article key={group.groupId} className={`rounded-[26px] border p-4 shadow-xl ${group.needsAttention ? 'border-amber-300/25 bg-amber-300/[0.055]' : 'border-white/10 bg-white/[0.035]'}`} data-testid={`algorithm-pair-${group.groupId}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black">{group.label}</h3>
                          {group.needsAttention && <span className="rounded-full bg-amber-300/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">Zásah</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Kolo {group.round} · {phaseLabel(group.phase)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {group.members.map((member) => <span key={member.participantId} title={`${member.nickname} · ${member.role}`} className={`h-2.5 w-2.5 rounded-full ${member.connected ? 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.45)]' : 'bg-slate-700'}`} />)}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {group.members.map((member) => (
                        <div key={member.participantId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/15 px-3 py-2.5">
                          {member.connected ? <Radio className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-slate-600" />}
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{member.nickname}</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200/60">{member.role}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <MiniStat icon={<Braces className="h-3.5 w-3.5" />} value={group.programLength} label="bloků" />
                      <MiniStat icon={<Play className="h-3.5 w-3.5" />} value={group.runs} label="běhů" />
                      <MiniStat icon={<RotateCcw className="h-3.5 w-3.5" />} value={group.failures} label="failů" />
                      <MiniStat icon={<HelpCircle className="h-3.5 w-3.5" />} value={group.hints} label="hintů" />
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600"><span>Mission energy</span><span>{group.missionEnergy}/6</span></div>
                      <div className="grid grid-cols-6 gap-1">
                        {(Object.entries(group.milestones) as Array<[MilestoneKey, boolean]>).map(([key, done]) => (
                          <div key={key} title={milestoneLabel[key]} className={`h-2 rounded-full ${done ? 'bg-cyan-300' : 'bg-white/[0.06]'}`} />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {analytics.ungrouped.length > 0 && (
              <section className="mt-4 rounded-[24px] border border-dashed border-amber-300/20 bg-amber-300/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-200/70">Bez dvojice</p>
                <div className="mt-2 flex flex-wrap gap-2">{analytics.ungrouped.map((student) => <span key={student.participantId} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs font-bold text-slate-300">{student.nickname}</span>)}</div>
              </section>
            )}

            <section className="sticky bottom-3 mt-5 rounded-[26px] border border-white/10 bg-[#08111f]/92 p-3 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {session?.status === 'RUNNING' && <ControlButton disabled={Boolean(busy)} onClick={() => void runCommand('PAUSE')} icon={<Pause className="h-4 w-4" />} label="Pozastavit všechny" />}
                  {session?.status === 'PAUSED' && <ControlButton disabled={Boolean(busy)} onClick={() => void runCommand('RESUME')} icon={<Play className="h-4 w-4" />} label="Pokračovat" primary />}
                  {(session?.status === 'RUNNING' || session?.status === 'PAUSED') && <ControlButton disabled={Boolean(busy)} onClick={() => void runCommand('FINISH')} icon={<CircleStop className="h-4 w-4" />} label="Ukončit hodinu" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500"><Sparkles className="h-4 w-4 text-violet-300" /> Gamifikace bez leaderboardu · 0 pointer streams</div>
              </div>
            </section>
          </>
        ) : (
          <div className="grid min-h-[65vh] place-items-center text-center text-slate-500"><div><RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-300" /><p className="mt-3 text-sm">Načítám živou mapu třídy…</p></div></div>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value, danger = false }: { icon: JSX.Element; label: string; value: string | number; danger?: boolean }): JSX.Element {
  return <div className={`rounded-[24px] border p-4 ${danger ? 'border-amber-300/20 bg-amber-300/[0.05]' : 'border-white/10 bg-white/[0.04]'}`}><div className="flex items-center justify-between text-slate-500"><span className="text-[9px] font-black uppercase tracking-[0.14em]">{label}</span>{icon}</div><div className={`mt-3 text-3xl font-black ${danger ? 'text-amber-100' : 'text-white'}`}>{value}</div></div>;
}

function MiniStat({ icon, value, label }: { icon: JSX.Element; value: number; label: string }): JSX.Element {
  return <div className="rounded-xl border border-white/5 bg-black/15 px-2 py-2"><div className="flex justify-center text-slate-600">{icon}</div><div className="mt-1 text-sm font-black">{value}</div><div className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-700">{label}</div></div>;
}

function ControlButton({ disabled, onClick, icon, label, primary = false }: { disabled: boolean; onClick: () => void; icon: JSX.Element; label: string; primary?: boolean }): JSX.Element {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition disabled:opacity-40 ${primary ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200' : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'}`}>{icon}{label}</button>;
}
