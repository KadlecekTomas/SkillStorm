'use client';

import {
  useCallback,
  useRef,
  type JSX,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, CloudOff, PauseCircle, Radio, ShieldCheck } from 'lucide-react';
import { useClassroomActivity } from '@/lib/use-classroom-activity';
import type { AlgorithmCommand } from '@/lib/it-lab/algorithm-engine';

const commandByLabel: Record<string, AlgorithmCommand> = {
  '↑ Krok': 'FORWARD',
  '↶ Vlevo': 'LEFT',
  '↷ Vpravo': 'RIGHT',
};

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? '';
}

export default function AlgorithmLabLayout({ children }: { children: ReactNode }): JSX.Element {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const classroom = useClassroomActivity(sessionId, 'algo');
  const programRef = useRef<AlgorithmCommand[]>([]);
  const missionRef = useRef(1);
  const runSerialRef = useRef(0);

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
      }, 250);
    },
    [classroom],
  );

  function handleClickCapture(event: MouseEvent<HTMLDivElement>): void {
    if (!classroom.isClassroomMode) return;

    if (!classroom.canInteract) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;
    const label = textOf(button);

    const command = commandByLabel[label];
    if (command) {
      programRef.current = [...programRef.current, command];
      void classroom.emit('ALGORITHM_STEP_ADDED', {
        mission: missionRef.current,
        command,
        stepIndex: programRef.current.length,
        programLength: programRef.current.length,
      });
      return;
    }

    if (label === 'Vymazat vše') {
      programRef.current = [];
      return;
    }

    const removeMatch = button.getAttribute('aria-label')?.match(/^Odstranit krok (\d+)$/);
    if (removeMatch) {
      const index = Number(removeMatch[1]) - 1;
      programRef.current = programRef.current.filter((_, currentIndex) => currentIndex !== index);
      return;
    }

    if (label.includes('Spustit program krok po kroku')) {
      const program = [...programRef.current];
      runSerialRef.current += 1;
      void classroom.emit('PROGRAM_RUN', {
        mission: missionRef.current,
        program,
        programLength: program.length,
      });
      publishOutcome(runSerialRef.current, program);
      return;
    }

    if (label.includes('Transfer: další mise')) {
      missionRef.current += 1;
      programRef.current = [];
    }
  }

  const blocked = classroom.isClassroomMode && !classroom.canInteract;

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
