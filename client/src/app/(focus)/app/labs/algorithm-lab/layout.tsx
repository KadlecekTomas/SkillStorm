'use client';

import {
  useCallback,
  useRef,
  useState,
  type JSX,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, CloudOff, PauseCircle, Radio, ShieldCheck, UsersRound } from 'lucide-react';
import { useClassroomActivity } from '@/lib/use-classroom-activity';
import { useNetworkedCoop } from '@/lib/use-networked-coop';
import type { AlgorithmCommand } from '@/lib/it-lab/algorithm-engine';

const commandByLabel: Record<string, AlgorithmCommand> = {
  '↑ Krok': 'FORWARD',
  '↶ Vlevo': 'LEFT',
  '↷ Vpravo': 'RIGHT',
};

const commandGlyph: Record<AlgorithmCommand, string> = {
  FORWARD: '↑',
  LEFT: '↶',
  RIGHT: '↷',
};

type CoopRole = 'PLANNER' | 'PROGRAMMER';

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? '';
}

export default function AlgorithmLabLayout({ children }: { children: ReactNode }): JSX.Element {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const groupId = searchParams.get('group');
  const classroom = useClassroomActivity(sessionId, 'algo', groupId);
  const programRef = useRef<AlgorithmCommand[]>([]);
  const missionRef = useRef(1);
  const runSerialRef = useRef(0);
  const [coopRole, setCoopRole] = useState<CoopRole>('PLANNER');
  const [rotationRound, setRotationRound] = useState(1);

  const sharedDeviceMode = classroom.projection?.mode === 'SHARED_DEVICES';
  const networkedMode =
    classroom.projection?.mode === 'HYBRID' && Boolean(classroom.projection.participant.groupId);
  const networked = useNetworkedCoop(sessionId, networkedMode);

  const collaborationRole = networkedMode
    ? networked.state?.myRole ?? 'WAITING'
    : sharedDeviceMode
      ? coopRole
      : null;
  const collaborationRound = networkedMode
    ? networked.state?.round ?? 1
    : rotationRound;

  const publishOutcome = useCallback(
    (serial: number, program: AlgorithmCommand[]): void => {
      let checks = 0;
      const timer = window.setInterval(() => {
        checks += 1;
        if (serial !== runSerialRef.current) {
          window.clearInterval(timer);
          return;
        }

        const result = document.querySelector<HTMLElement>('[data-testid="algorithm-result"]');
        const runningButton = Array.from(document.querySelectorAll('button')).some((button) =>
          textOf(button).includes('Provádím algoritmus'),
        );

        if ((!result || runningButton) && checks < 48) return;
        window.clearInterval(timer);
        if (!result) return;

        const resultText = textOf(result);
        const robot = document.querySelector<HTMLElement>('[data-testid="algorithm-robot"]');
        const payload = {
          mission: missionRef.current,
          program,
          programLength: program.length,
          finalPosition: robot
            ? { x: Number(robot.dataset.x), y: Number(robot.dataset.y) }
            : null,
          finalDirection: robot?.dataset.direction ?? null,
          deliveryMode: classroom.projection?.mode ?? null,
          collaborationRole,
          collaborationRound,
        };

        if (resultText.includes('Algoritmus funguje.')) {
          void classroom.emit('CHECKPOINT_COMPLETED', {
            ...payload,
            checkpoint: `ALGORITHM_MISSION_${missionRef.current}`,
            completionIsMastery: false,
          });
          return;
        }

        const diagnostic = resultText.match(/krok\s+(\d+)/i)?.[1] ?? null;
        void classroom.emit('TEST_FAILED', {
          ...payload,
          failedStep: diagnostic ? Number(diagnostic) : null,
          failureKind: resultText.includes('překážky')
            ? 'OBSTACLE_COLLISION'
            : resultText.includes('mimo arénu')
              ? 'OUT_OF_BOUNDS'
              : 'TARGET_NOT_REACHED',
        });

        if (networkedMode) {
          void networked.rotate('TEST_FAILED');
        } else if (sharedDeviceMode) {
          setCoopRole('PLANNER');
          setRotationRound((current) => current + 1);
        }
      }, 250);
    },
    [
      classroom,
      collaborationRole,
      collaborationRound,
      networked,
      networkedMode,
      sharedDeviceMode,
    ],
  );

  function isProgrammerAction(button: HTMLButtonElement, label: string): boolean {
    return Boolean(
      commandByLabel[label] ||
      label === 'Vymazat vše' ||
      label.includes('Spustit program krok po kroku') ||
      button.getAttribute('aria-label')?.startsWith('Odstranit krok '),
    );
  }

  function programmerMayAct(): boolean {
    if (networkedMode) {
      return networked.state?.myRole === 'PROGRAMMER' && networked.state.phase === 'PROGRAM';
    }
    if (sharedDeviceMode) return coopRole === 'PROGRAMMER';
    return true;
  }

  function syncNetworkedProgram(): void {
    if (networkedMode) void networked.syncProgram([...programRef.current]);
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>): void {
    if (!classroom.isClassroomMode) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-coop-control="true"]')) return;

    if (!classroom.canInteract) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;
    const label = textOf(button);

    if ((sharedDeviceMode || networkedMode) && isProgrammerAction(button, label) && !programmerMayAct()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const command = commandByLabel[label];
    if (command) {
      programRef.current = [...programRef.current, command];
      syncNetworkedProgram();
      void classroom.emit('ALGORITHM_STEP_ADDED', {
        mission: missionRef.current,
        command,
        stepIndex: programRef.current.length,
        programLength: programRef.current.length,
        collaborationRole,
        collaborationRound,
      });
      return;
    }

    if (label === 'Vymazat vše') {
      programRef.current = [];
      syncNetworkedProgram();
      return;
    }

    const removeMatch = button.getAttribute('aria-label')?.match(/^Odstranit krok (\d+)$/);
    if (removeMatch) {
      const index = Number(removeMatch[1]) - 1;
      programRef.current = programRef.current.filter((_, currentIndex) => currentIndex !== index);
      syncNetworkedProgram();
      return;
    }

    if (label.includes('Spustit program krok po kroku')) {
      const program = [...programRef.current];
      runSerialRef.current += 1;
      void classroom.emit('PROGRAM_RUN', {
        mission: missionRef.current,
        program,
        programLength: program.length,
        collaborationRole,
        collaborationRound,
      });
      publishOutcome(runSerialRef.current, program);
      return;
    }

    if (label.includes('Transfer: další mise')) {
      missionRef.current += 1;
      programRef.current = [];
      if (networkedMode) {
        void networked.rotate('MISSION_COMPLETED');
      } else if (sharedDeviceMode) {
        setCoopRole('PLANNER');
        setRotationRound((current) => current + 1);
      }
    }
  }

  const blocked = classroom.isClassroomMode && !classroom.canInteract;
  const showLocalCoop = sharedDeviceMode && classroom.canInteract;
  const showNetworkedCoop = networkedMode && classroom.canInteract;

  return (
    <div
      className="relative min-h-[100dvh] bg-slate-950"
      data-testid="algorithm-classroom-shell"
      onClickCapture={handleClickCapture}
    >
      {classroom.isClassroomMode && (
        <div className="fixed left-1/2 top-3 z-[80] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-[#07101f]/92 px-3 py-2 text-xs font-semibold text-slate-200 shadow-2xl backdrop-blur-xl">
          {classroom.error ? (
            <CloudOff className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
          ) : classroom.projection?.status === 'RUNNING' && classroom.canInteract ? (
            <Radio className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : (
            <Cloud className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
          )}
          <span className="truncate" data-testid="algorithm-classroom-session-label">
            {classroom.sessionLabel}
          </span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="hidden items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span data-testid="algorithm-server-event-count">{classroom.confirmedEvents}</span> semantic events
          </span>
        </div>
      )}

      {showLocalCoop && (
        <div
          data-testid="algorithm-coop-banner"
          className="fixed left-1/2 top-16 z-[75] w-[min(680px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-violet-300/20 bg-[#11172a]/95 p-3 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/60">
                  Sdílené zařízení · kolo {rotationRound}
                </p>
                <p className="mt-1 text-sm font-black" data-testid="algorithm-coop-role">
                  {coopRole === 'PLANNER' ? 'Planner plánuje' : 'Programmer ovládá zařízení'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {coopRole === 'PLANNER'
                    ? 'Planner vysvětlí trasu nahlas a nesmí zatím skládat bloky. Až je plán jasný, předá zařízení.'
                    : 'Programmer podle domluveného plánu sestaví a spustí program. Po chybě se role vrátí Plannerovi k diagnóze.'}
                </p>
              </div>
            </div>
            {coopRole === 'PLANNER' ? (
              <button
                type="button"
                data-coop-control="true"
                data-testid="algorithm-coop-handoff"
                onClick={() => setCoopRole('PROGRAMMER')}
                className="shrink-0 rounded-xl bg-violet-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                Plán hotový · předat →
              </button>
            ) : (
              <button
                type="button"
                data-coop-control="true"
                data-testid="algorithm-coop-return"
                onClick={() => {
                  setCoopRole('PLANNER');
                  setRotationRound((current) => current + 1);
                }}
                className="shrink-0 rounded-xl border border-violet-300/30 px-4 py-2 text-sm font-bold text-violet-100 transition hover:bg-violet-300/10 focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                Vrátit Plannerovi
              </button>
            )}
          </div>
        </div>
      )}

      {showNetworkedCoop && (
        <div
          data-testid="algorithm-networked-coop-banner"
          className="fixed left-1/2 top-16 z-[75] w-[min(820px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-cyan-300/20 bg-[#0b1729]/95 p-3 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/60">
                  Síťová dvojice · kolo {networked.state?.round ?? 1}
                </p>
                <p className="mt-1 text-sm font-black" data-testid="algorithm-networked-coop-role">
                  {networked.loading
                    ? 'Synchronizuji role…'
                    : networked.state?.myRole === 'PLANNER'
                      ? networked.state.phase === 'PLAN'
                        ? 'Jsi Planner · navrhni řešení'
                        : 'Planner sleduje živý program'
                      : networked.state?.myRole === 'PROGRAMMER'
                        ? networked.state.phase === 'PROGRAM'
                          ? 'Jsi Programmer · sestav a spusť program'
                          : 'Programmer čeká na plán'
                        : networked.state?.myRole === 'WAITING'
                          ? 'Čekám na druhé zařízení dvojice'
                          : 'Pozorovatel dvojice'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {networked.state?.peers.map((peer) => `${peer.nickname}: ${peer.role}${peer.connected ? '' : ' · offline'}`).join(' · ') ||
                    'Role se načítají ze serveru. Po reconnectu se dvojice vrátí do stejného kola.'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="algorithm-networked-program-mirror">
                  <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/50">
                    Program v{networked.program?.programRevision ?? 0}
                  </span>
                  {networked.program?.commands.length ? (
                    networked.program.commands.map((command, index) => (
                      <span
                        key={`${networked.program?.programRevision ?? 0}-${index}-${command}`}
                        data-testid={`algorithm-networked-program-step-${index + 1}`}
                        className="grid h-7 min-w-7 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 text-xs font-black text-cyan-100"
                      >
                        {commandGlyph[command]}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">zatím prázdný</span>
                  )}
                </div>
                {networked.error && <p className="mt-1 text-xs text-rose-200">{networked.error}</p>}
              </div>
            </div>
            {networked.state?.myRole === 'PLANNER' && networked.state.phase === 'PLAN' && (
              <button
                type="button"
                data-coop-control="true"
                data-testid="algorithm-networked-coop-handoff"
                onClick={() => void networked.handoff()}
                className="shrink-0 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              >
                Plán hotový · předat Programmerovi →
              </button>
            )}
            {networked.state?.myRole === 'PROGRAMMER' && networked.state.phase === 'PROGRAM' && (
              <button
                type="button"
                data-coop-control="true"
                data-testid="algorithm-networked-coop-rotate"
                onClick={() => void networked.rotate('MANUAL_HAND_BACK')}
                className="shrink-0 rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                Uzavřít běh · prohodit role
              </button>
            )}
          </div>
        </div>
      )}

      {children}

      {blocked && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#07101f]/72 px-4 backdrop-blur-sm" data-testid="algorithm-classroom-blocking-overlay">
          <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#0b1729] p-6 text-center text-white shadow-[0_30px_100px_rgba(0,0,0,.55)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <PauseCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/60">Classroom control</p>
            <h2 className="mt-2 text-xl font-black">{classroom.sessionLabel}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Učitel řídí společnou etapu. Rozpracovaný algoritmus zůstává na místě a pokračuješ přesně odsud po obnovení session.
            </p>
            {classroom.error && <p className="mt-4 text-xs text-rose-200">{classroom.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
